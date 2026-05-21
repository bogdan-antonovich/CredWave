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
import { getLoggerToken } from 'nestjs-pino';
import * as serpapi from 'serpapi';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { EmailService } from '../../email/email.serivice';
import type { SerpReview } from './reviews.types';

class MockJwtGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx
      .switchToHttp()
      .getRequest<{ headers: Record<string, string> }>();
    if (!req.headers['authorization']) throw new UnauthorizedException();
    return true;
  }
}

jest.mock('serpapi', () => ({ getJson: jest.fn() }));
const mockGetJson = jest.mocked(serpapi.getJson);

const FAKE_OUTSCRAPER_REVIEW = {
  review_id: 'outscraper-review-abc',
  author_title: 'Alice',
  author_image: 'https://example.com/alice.jpg',
  review_text: 'Great food!',
  review_rating: 5,
  review_datetime_utc: '2024-01-01 00:00:00',
  review_link: null,
  review_pagination_id: 'pag1',
  owner_answer: null,
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
  let mockOutscraperClient: { googleMapsReviews: jest.Mock };

  let userId: number;
  let restaurantId: number;

  beforeAll(() => {
    sql = postgres(global.__DATABASE_URL__);
  });

  afterAll(async () => {
    await sql.end();
  });

  beforeEach(async () => {
    jest.resetAllMocks();

    mockOutscraperClient = {
      googleMapsReviews: jest.fn().mockResolvedValue([[]]),
    };

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

    // Seed restaurant
    const [restaurant] = await sql<{ id: number }[]>`
      INSERT INTO restaurants (user_id, google_place_id, name, last_synced_at)
      VALUES (${userId}, 'ChIJ_fake_place_id', 'Pasta Place', NOW())
      RETURNING id
    `;
    restaurantId = restaurant.id;

    // Seed a review
    await sql`
      INSERT INTO reviews (
        restaurant_id, google_review_id, reviewer_name,
        reviewer_avatar_url, review_text, rating, posted_at, replied
      )
      VALUES (
        ${restaurantId}, 'google-review-abc', 'Alice',
        'https://example.com/alice.jpg', 'Great food!', 5,
        '2024-01-01T00:00:00Z', false
      )
    `;

    // Build NestJS app
    const moduleRef = await Test.createTestingModule({
      imports: [LoggerModule.forRoot({ pinoHttp: { level: 'silent' } })],
      controllers: [ReviewsController],
      providers: [
        ReviewsService,
        { provide: 'SQL', useValue: sql },
        { provide: 'OPENAI', useValue: { chat: { completions: { create: jest.fn() } } } },
        { provide: 'OUTSCRAPER_CLIENT', useValue: mockOutscraperClient },
        { provide: EmailService, useValue: { sendNewReview: jest.fn() } },
        {
          provide: AppConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'serpapi') return { apiKey: 'fake-serp-key' };
              if (key === 'openai') return { model: 'gpt-4o' };
              throw new Error(`Unknown config key: ${key}`);
            },
          },
        },
        {
          provide: getLoggerToken(ReviewsService.name),
          useValue: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), trace: jest.fn() },
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
        pagination: { page: number; per_page: number; total: number; total_pages: number };
        stats: { pending: number; replied: number; total: number };
      };

      expect(body.reviews).toHaveLength(1);
      expect(body.pagination.total).toBe(1);
      expect(body.stats.pending).toBe(1);
      expect(body.stats.replied).toBe(0);
      expect(body.stats.total).toBe(1);
    });

    it('filters pending reviews correctly', async () => {
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

      const body = res.body as { reviews: unknown[]; pagination: { total: number } };
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

      const body = res.body as { reviews: unknown[]; pagination: { total: number } };
      expect(body.reviews).toHaveLength(1);
      expect(body.pagination.total).toBe(1);
    });

    it('respects pagination params', async () => {
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
      await sql`
        UPDATE restaurants SET last_synced_at = NOW() - INTERVAL '2 hours'
        WHERE id = ${restaurantId}
      `;

      mockOutscraperClient.googleMapsReviews.mockResolvedValueOnce([{ reviews_data: [] }]);

      await request(server)
        .get(`/restaurants/${restaurantId}/reviews`)
        .set('Authorization', 'Bearer fake-token')
        .expect(200);

      expect(mockOutscraperClient.googleMapsReviews).toHaveBeenCalled();
    });

    it('does not trigger syncReviews when data is fresh', async () => {
      await request(server)
        .get(`/restaurants/${restaurantId}/reviews`)
        .set('Authorization', 'Bearer fake-token')
        .expect(200);

      expect(mockOutscraperClient.googleMapsReviews).not.toHaveBeenCalled();
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

    it('inserts new reviews from Outscraper and returns count', async () => {
      await sql`TRUNCATE reviews CASCADE`;

      mockOutscraperClient.googleMapsReviews.mockResolvedValueOnce([
        { reviews_data: [FAKE_OUTSCRAPER_REVIEW] },
      ]);

      const res = await request(server)
        .post(`/restaurants/${restaurantId}/reviews/sync`)
        .set('Authorization', 'Bearer fake-token')
        .expect(201);

      const body = res.body as { new_reviews: number; synced_at: string };
      expect(body.new_reviews).toBe(1);
      expect(body.synced_at).toBeDefined();

      const rows = await sql`SELECT * FROM reviews WHERE restaurant_id = ${restaurantId}`;
      expect(rows).toHaveLength(1);
      expect(rows[0].google_review_id).toBe('outscraper-review-abc');
      expect(rows[0].rating).toBe(5);
    });

    it('does not count existing reviews as new', async () => {
      mockOutscraperClient.googleMapsReviews.mockResolvedValueOnce([
        { reviews_data: [{ ...FAKE_OUTSCRAPER_REVIEW, review_id: 'google-review-abc' }] },
      ]);

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

      mockOutscraperClient.googleMapsReviews.mockResolvedValueOnce([{ reviews_data: [] }]);

      await request(server)
        .post(`/restaurants/${restaurantId}/reviews/sync`)
        .set('Authorization', 'Bearer fake-token')
        .expect(201);

      const [after] = await sql<{ last_synced_at: Date }[]>`
        SELECT last_synced_at FROM restaurants WHERE id = ${restaurantId}
      `;
      expect(after.last_synced_at.getTime()).toBeGreaterThan(before.last_synced_at.getTime());
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
        expect.objectContaining({ engine: 'google_maps_reviews', place_id: 'new-place-id' }),
      );

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
