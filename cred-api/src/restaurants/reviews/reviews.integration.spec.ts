import { LoggerModule } from 'nestjs-pino';
import { Test } from '@nestjs/testing';
import {
  INestApplication,
  UnauthorizedException,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'http';
import postgres, { type Sql } from 'postgres';
import { AuthGuard } from '@nestjs/passport';
import { AppConfigService } from 'src/config/config.service';
import { google } from 'googleapis';
import type { AuthPlus } from 'googleapis-common';
import type { Credentials } from 'google-auth-library';
import type { GaxiosOptions, GaxiosResponse } from 'gaxios';
import * as serpapi from 'serpapi';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import type { GoogleReview, SerpReview } from './reviews.types';

// type AuthRequestFn = <T>(opts: GaxiosOptions) => Promise<GaxiosResponse<T>>;

const mockAuthRequest = jest.fn<
  Promise<GaxiosResponse<unknown>>,
  [GaxiosOptions]
>();
const mockSetCredentials = jest.fn<void, [Credentials]>();

class MockJwtGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx
      .switchToHttp()
      .getRequest<{ headers: Record<string, string> }>();
    if (!req.headers['authorization']) throw new UnauthorizedException();
    return true;
  }
}

jest.mock('googleapis', () => ({
  google: { auth: { OAuth2: jest.fn() } },
}));

const mockedAuth = google.auth as jest.Mocked<AuthPlus>;

jest.mock('serpapi', () => ({ getJson: jest.fn() }));
const mockGetJson = jest.mocked(serpapi.getJson);

const FAKE_GOOGLE_REVIEW: GoogleReview = {
  reviewId: 'google-review-abc',
  reviewer: {
    displayName: 'Alice',
    profilePhotoUrl: 'https://example.com/alice.jpg',
  },
  starRating: 'FIVE',
  comment: 'Great food!',
  createTime: '2024-01-01T00:00:00Z',
};

const FAKE_GOOGLE_REVIEW_WITH_REPLY: GoogleReview = {
  ...FAKE_GOOGLE_REVIEW,
  reviewId: 'google-review-replied',
  reviewReply: { comment: 'Thank you!', updateTime: '2024-01-02T00:00:00Z' },
};

const FAKE_SERP_REVIEWS: SerpReview[] = [
  {
    rating: 1,
    snippet: 'Terrible experience',
    iso_date: '2024-01-01',
    user: { name: 'Bob', thumbnail: 'https://example.com/bob.jpg' },
  },
  {
    rating: 4,
    snippet: 'Pretty good',
    iso_date: '2024-01-02',
    user: { name: 'Carol', thumbnail: 'https://example.com/carol.jpg' },
  },
];

describe('/restaurants/:id/reviews', () => {
  let sql: Sql;
  let app: INestApplication;
  let server: Server;

  let userId: number;
  let restaurantId: number;
  // let reviewId: number;

  beforeAll(() => {
    sql = postgres(global.__DATABASE_URL__);
  });

  afterAll(async () => {
    await sql.end();
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    jest.spyOn(mockedAuth, 'OAuth2').mockImplementation(
      () =>
        ({
          setCredentials: mockSetCredentials,
          request: mockAuthRequest,
        }) as unknown as InstanceType<typeof mockedAuth.OAuth2>,
    );

    // Clean all tables in dependency order
    await sql`
      TRUNCATE
        auto_demo_reviews,
        responses,
        reviews,
        gl_access_tokens,
        gl_refresh_tokens,
        auth_tokens,
        blacklisted_tokens,
        restaurants,
        subscriptions,
        payment_methods,
        invoices,
        contacts,
        users
      CASCADE
    `;

    // Seed user
    const [user] = await sql<{ id: number }[]>`
      INSERT INTO users (email, name)
      VALUES ('alice@example.com', 'Alice')
      RETURNING id
    `;
    userId = user.id;

    // Seed access token
    await sql`
      INSERT INTO gl_access_tokens (user_id, token, expires_at)
      VALUES (${userId}, 'ya29.fake-token', NOW() + INTERVAL '1 hour')
    `;

    // Seed restaurant
    const [restaurant] = await sql<{ id: number }[]>`
      INSERT INTO restaurants (user_id, google_account_id, google_location_id, name, last_synced_at)
      VALUES (${userId}, 'accounts/123', 'locations/456', 'Pasta Place', NOW())
      RETURNING id
    `;
    restaurantId = restaurant.id;

    // Seed a review
    await sql<{ id: number }[]>`
      INSERT INTO reviews (
        restaurant_id, google_review_id, reviewer_name,
        reviewer_avatar_url, review_text, rating, posted_at, replied
      )
      VALUES (
        ${restaurantId}, 'google-review-abc', 'Alice',
        'https://example.com/alice.jpg', 'Great food!', 5,
        '2024-01-01T00:00:00Z', false
      )
      RETURNING id
    `;
    // reviewId = review.id;

    // Build NestJS app
    const moduleRef = await Test.createTestingModule({
      imports: [LoggerModule.forRoot({ pinoHttp: { level: 'silent' } })],
      controllers: [ReviewsController],
      providers: [
        ReviewsService,
        { provide: 'SQL', useValue: sql },
        {
          provide: AppConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'serpapi') return { apiKey: 'fake-serp-key' };
              throw new Error(`Unknown config key: ${key}`);
            },
          },
        },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useClass(MockJwtGuard)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /restaurants/:id/reviews', () => {
    it('returns 401 when no JWT is provided', async () => {
      await request(server)
        .get(`/restaurants/${restaurantId}/reviews`)
        .expect(401);
    });

    it('returns reviews with pagination and stats', async () => {
      const res = await request(server)
        .get(`/restaurants/${restaurantId}/reviews`)
        .set('Authorization', 'Bearer fake-token')
        .expect(200);

      const body = res.body as {
        reviews: unknown[];
        pagination: {
          page: number;
          per_page: number;
          total: number;
          total_pages: number;
        };
        stats: { pending: number; replied: number; total: number };
      };

      expect(body.reviews).toHaveLength(1);
      expect(body.pagination.total).toBe(1);
      expect(body.stats.pending).toBe(1);
      expect(body.stats.replied).toBe(0);
      expect(body.stats.total).toBe(1);
    });

    it('filters pending reviews correctly', async () => {
      // Add a replied review
      await sql`
        INSERT INTO reviews (
          restaurant_id, google_review_id, reviewer_name,
          reviewer_avatar_url, review_text, rating, posted_at, replied
        )
        VALUES (
          ${restaurantId}, 'google-review-replied', 'Bob',
          'https://example.com/bob.jpg', 'Good!', 4,
          '2024-01-02T00:00:00Z', true
        )
      `;

      const res = await request(server)
        .get(`/restaurants/${restaurantId}/reviews?status=pending`)
        .set('Authorization', 'Bearer fake-token')
        .expect(200);

      const body = res.body as {
        reviews: unknown[];
        pagination: { total: number };
      };
      expect(body.reviews).toHaveLength(1);
      expect(body.pagination.total).toBe(1);
    });

    it('filters replied reviews correctly', async () => {
      await sql`
        INSERT INTO reviews (
          restaurant_id, google_review_id, reviewer_name,
          reviewer_avatar_url, review_text, rating, posted_at, replied
        )
        VALUES (
          ${restaurantId}, 'google-review-replied', 'Bob',
          'https://example.com/bob.jpg', 'Good!', 4,
          '2024-01-02T00:00:00Z', true
        )
      `;

      const res = await request(server)
        .get(`/restaurants/${restaurantId}/reviews?status=replied`)
        .set('Authorization', 'Bearer fake-token')
        .expect(200);

      const body = res.body as {
        reviews: unknown[];
        pagination: { total: number };
      };
      expect(body.reviews).toHaveLength(1);
      expect(body.pagination.total).toBe(1);
    });

    it('respects pagination params', async () => {
      // Insert 5 more reviews
      for (let i = 0; i < 5; i++) {
        await sql`
          INSERT INTO reviews (
            restaurant_id, google_review_id, reviewer_name,
            reviewer_avatar_url, review_text, rating, posted_at, replied
          )
          VALUES (
            ${restaurantId}, ${`google-review-extra-${i}`}, 'Extra',
            'https://example.com/extra.jpg', 'Review', 3,
            ${`2024-01-0${i + 2}T00:00:00Z`}, false
          )
        `;
      }

      const res = await request(server)
        .get(`/restaurants/${restaurantId}/reviews?page=1&per_page=2`)
        .set('Authorization', 'Bearer fake-token')
        .expect(200);

      const body = res.body as {
        reviews: unknown[];
        pagination: { page: number; per_page: number; total_pages: number };
      };
      expect(body.reviews).toHaveLength(2);
      expect(body.pagination.page).toBe(1);
      expect(body.pagination.per_page).toBe(2);
      expect(body.pagination.total_pages).toBe(3);
    });

    it('returns 404 when restaurant does not exist', async () => {
      await request(server)
        .get(`/restaurants/99999/reviews`)
        .set('Authorization', 'Bearer fake-token')
        .expect(404);
    });

    it('triggers syncReviews when data is stale', async () => {
      // Make last_synced_at stale
      await sql`
        UPDATE restaurants SET last_synced_at = NOW() - INTERVAL '10 minutes'
        WHERE id = ${restaurantId}
      `;

      mockAuthRequest.mockResolvedValueOnce({
        data: { reviews: [FAKE_GOOGLE_REVIEW] },
        status: 200,
      } as GaxiosResponse<{ reviews: GoogleReview[] }>);

      await request(server)
        .get(`/restaurants/${restaurantId}/reviews`)
        .set('Authorization', 'Bearer fake-token')
        .expect(200);

      expect(mockAuthRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('locations/456/reviews') as string,
        }),
      );
    });

    it('does not trigger syncReviews when data is fresh', async () => {
      // last_synced_at is set to NOW() in beforeEach — data is fresh
      await request(server)
        .get(`/restaurants/${restaurantId}/reviews`)
        .set('Authorization', 'Bearer fake-token')
        .expect(200);

      expect(mockAuthRequest).not.toHaveBeenCalled();
    });
  });

  describe('POST /restaurants/:id/reviews/sync', () => {
    it('returns 401 when no JWT is provided', async () => {
      await request(server)
        .post(`/restaurants/${restaurantId}/reviews/sync`)
        .expect(401);
    });

    it('returns 404 when restaurant does not exist', async () => {
      await request(server)
        .post(`/restaurants/99999/reviews/sync`)
        .set('Authorization', 'Bearer fake-token')
        .expect(404);
    });

    it('inserts new reviews from Google and returns count', async () => {
      // Delete the seeded review so we start fresh
      await sql`TRUNCATE reviews CASCADE`;

      mockAuthRequest.mockResolvedValueOnce({
        data: { reviews: [FAKE_GOOGLE_REVIEW] },
        status: 200,
      } as GaxiosResponse<{ reviews: GoogleReview[] }>);

      const res = await request(server)
        .post(`/restaurants/${restaurantId}/reviews/sync`)
        .set('Authorization', 'Bearer fake-token')
        .expect(201);

      const body = res.body as { new_reviews: number; synced_at: string };
      expect(body.new_reviews).toBe(1);
      expect(body.synced_at).toBeDefined();

      const rows =
        await sql`SELECT * FROM reviews WHERE restaurant_id = ${restaurantId}`;
      expect(rows).toHaveLength(1);
      expect(rows[0].google_review_id).toBe('google-review-abc');
      expect(rows[0].rating).toBe(5);
    });

    it('updates existing review reply status on conflict', async () => {
      // Review already exists (seeded in beforeEach) — sync returns a replied version
      mockAuthRequest.mockResolvedValueOnce({
        data: { reviews: [FAKE_GOOGLE_REVIEW_WITH_REPLY] },
        status: 200,
      } as GaxiosResponse<{ reviews: GoogleReview[] }>);

      // Seed the review that will conflict
      await sql`
        INSERT INTO reviews (
          restaurant_id, google_review_id, reviewer_name,
          reviewer_avatar_url, review_text, rating, posted_at, replied
        )
        VALUES (
          ${restaurantId}, 'google-review-replied', 'Alice',
          'https://example.com/alice.jpg', 'Great!', 5,
          '2024-01-01T00:00:00Z', false
        )
      `;

      await request(server)
        .post(`/restaurants/${restaurantId}/reviews/sync`)
        .set('Authorization', 'Bearer fake-token')
        .expect(201);

      const [row] = await sql<{ replied: boolean; reply_text: string }[]>`
        SELECT replied, reply_text FROM reviews WHERE google_review_id = 'google-review-replied'
      `;
      expect(row.replied).toBe(true);
      expect(row.reply_text).toBe('Thank you!');
    });

    it('does not count existing reviews as new', async () => {
      // google-review-abc already seeded in beforeEach
      mockAuthRequest.mockResolvedValueOnce({
        data: { reviews: [FAKE_GOOGLE_REVIEW] },
        status: 200,
      } as GaxiosResponse<{ reviews: GoogleReview[] }>);

      const res = await request(server)
        .post(`/restaurants/${restaurantId}/reviews/sync`)
        .set('Authorization', 'Bearer fake-token')
        .expect(201);

      const body = res.body as { new_reviews: number };
      expect(body.new_reviews).toBe(0);
    });

    it('updates last_synced_at on the restaurant', async () => {
      const [before] = await sql<{ last_synced_at: Date }[]>`
        SELECT last_synced_at FROM restaurants WHERE id = ${restaurantId}
      `;

      mockAuthRequest.mockResolvedValueOnce({
        data: { reviews: [] },
        status: 200,
      } as unknown as GaxiosResponse<{ reviews: GoogleReview[] }>);

      await request(server)
        .post(`/restaurants/${restaurantId}/reviews/sync`)
        .set('Authorization', 'Bearer fake-token')
        .expect(201);

      const [after] = await sql<{ last_synced_at: Date }[]>`
        SELECT last_synced_at FROM restaurants WHERE id = ${restaurantId}
      `;

      expect(after.last_synced_at.getTime()).toBeGreaterThan(
        before.last_synced_at.getTime(),
      );
    });
  });

  describe('GET /restaurants/:id/reviews/demo', () => {
    it('returns cached reviews from DB when available', async () => {
      await sql`
        INSERT INTO auto_demo_reviews (place_id, reviews)
        VALUES ('fake-place-id', ${sql.json(FAKE_SERP_REVIEWS)})
      `;

      const res = await request(server)
        .get(`/restaurants/fake-place-id/reviews/demo`)
        .expect(200);

      const body = res.body as { reviews: SerpReview[] };
      expect(body.reviews).toHaveLength(2);
      expect(mockGetJson).not.toHaveBeenCalled();
    });

    it('calls SerpApi and caches results when no DB cache exists', async () => {
      mockGetJson.mockResolvedValueOnce({ reviews: FAKE_SERP_REVIEWS });

      const res = await request(server)
        .get(`/restaurants/new-place-id/reviews/demo`)
        .expect(200);

      const body = res.body as { reviews: SerpReview[] };
      expect(body.reviews.length).toBeGreaterThan(0);
      expect(mockGetJson).toHaveBeenCalledWith(
        expect.objectContaining({
          engine: 'google_maps_reviews',
          place_id: 'new-place-id',
        }),
      );

      // Verify it was cached
      const [row] = await sql<{ reviews: SerpReview[] }[]>`
        SELECT reviews FROM auto_demo_reviews WHERE place_id = 'new-place-id'
      `;
      expect(row).toBeDefined();
      expect(row.reviews.length).toBeGreaterThan(0);
    });

    it('filters out reviews that already have a response', async () => {
      const reviewsWithResponse: SerpReview[] = [
        {
          rating: 1,
          snippet: 'Bad',
          iso_date: '2024-01-01',
          user: { name: 'X', thumbnail: '' },
          response: { snippet: 'Sorry!', date: '2024-01-02' },
        },
        ...FAKE_SERP_REVIEWS,
      ];

      mockGetJson.mockResolvedValueOnce({ reviews: reviewsWithResponse });

      const res = await request(server)
        .get(`/restaurants/filter-place-id/reviews/demo`)
        .expect(200);

      const body = res.body as { reviews: SerpReview[] };
      // The review with a response should have been filtered out
      expect(body.reviews.every((r) => !r.response)).toBe(true);
    });

    it('returns max 2 bad reviews (rating <= 2) and max 3 others', async () => {
      const manyReviews: SerpReview[] = [
        ...Array.from({ length: 4 }, (_, i) => ({
          rating: 1,
          snippet: `Bad ${i}`,
          iso_date: '2024-01-01',
          user: { name: `Bad${i}`, thumbnail: '' },
        })),
        ...Array.from({ length: 5 }, (_, i) => ({
          rating: 5,
          snippet: `Good ${i}`,
          iso_date: '2024-01-01',
          user: { name: `Good${i}`, thumbnail: '' },
        })),
      ];

      mockGetJson.mockResolvedValueOnce({ reviews: manyReviews });

      const res = await request(server)
        .get(`/restaurants/limits-place-id/reviews/demo`)
        .expect(200);

      const body = res.body as { reviews: SerpReview[] };
      const bad = body.reviews.filter((r) => r.rating <= 2);
      const good = body.reviews.filter((r) => r.rating > 2);

      expect(bad.length).toBeLessThanOrEqual(2);
      expect(good.length).toBeLessThanOrEqual(3);
      expect(body.reviews.length).toBeLessThanOrEqual(5);
    });
  });
});
