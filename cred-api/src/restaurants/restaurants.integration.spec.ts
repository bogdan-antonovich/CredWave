import { LoggerModule } from 'nestjs-pino';
import { Test } from '@nestjs/testing';
import {
  INestApplication,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import request from 'supertest';
import postgres, { type Sql } from 'postgres';
import { AuthGuard } from '@nestjs/passport';
import { RestaurantsController } from './restaurants.controller';
import { RestaurantsService } from './restaurants.service';
import { AppConfigService } from 'src/config/config.service';
import { getLoggerToken } from 'nestjs-pino';
import type { Server } from 'http';

const silentLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  trace: jest.fn(),
};

// Use plain functions so jest.resetAllMocks() doesn't wipe them
const configMock = {
  get: (key: string) => {
    if (key === 'google') return { places: { apiKey: 'fake-key' } };
    return undefined;
  },
};

describe('Restaurants (integration)', () => {
  let sql: Sql;
  let app: INestApplication;
  let server: Server;
  let userId: number;
  let restaurantId: number;

  beforeAll(() => {
    sql = postgres(global.__DATABASE_URL__);
  });

  afterAll(async () => {
    await sql.end();
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    await sql`TRUNCATE responses, reviews, gl_access_tokens, restaurants, users CASCADE`;

    const [user] = await sql<{ id: number }[]>`
      INSERT INTO users (email, name, picture_url)
      VALUES ('rest-test@example.com', 'Rest User', 'https://img.com/pic.png')
      RETURNING id
    `;
    userId = user.id;

    const [restaurant] = await sql<{ id: number }[]>`
      INSERT INTO restaurants (name, user_id, google_place_id)
      VALUES ('Test Bistro', ${userId}, 'ChIJ_fake_place_id')
      RETURNING id
    `;
    restaurantId = restaurant.id;

    const moduleRef = await Test.createTestingModule({
      imports: [LoggerModule.forRoot({ pinoHttp: { level: 'silent' } })],
      controllers: [RestaurantsController],
      providers: [
        RestaurantsService,
        { provide: 'SQL', useValue: sql },
        { provide: AppConfigService, useValue: configMock },
        { provide: getLoggerToken(RestaurantsService.name), useValue: silentLogger },
        { provide: getLoggerToken(RestaurantsController.name), useValue: silentLogger },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue({
        canActivate(ctx: ExecutionContext) {
          const req = ctx.switchToHttp().getRequest<{ user: { id: number } }>();
          req.user = { id: userId };
          return true;
        },
      } satisfies CanActivate)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterEach(async () => {
    await app.close();
  });

  describe('PATCH /restaurants/:id', () => {
    it('updates restaurant info and returns 204', async () => {
      await request(server)
        .patch(`/restaurants/${restaurantId}`)
        .set('Authorization', 'Bearer token')
        .send({ name: 'Updated Bistro', ownerName: 'Jane', additionalInfo: 'Cozy place' })
        .expect(204);

      const [row] = await sql<{ name: string; owner_name: string; additional_info: string }[]>`
        SELECT name, owner_name, additional_info FROM restaurants WHERE id = ${restaurantId}
      `;
      expect(row.name).toBe('Updated Bistro');
      expect(row.owner_name).toBe('Jane');
      expect(row.additional_info).toBe('Cozy place');
    });

    it('returns 204 even when restaurant id does not exist', async () => {
      await request(server)
        .patch('/restaurants/99999')
        .set('Authorization', 'Bearer token')
        .send({ name: 'Ghost', ownerName: null, additionalInfo: null })
        .expect(204);
    });
  });

  describe('GET /restaurants/:id/auto-reply', () => {
    it('returns default auto-reply settings', async () => {
      const res = await request(server)
        .get(`/restaurants/${restaurantId}/auto-reply`)
        .set('Authorization', 'Bearer token')
        .expect(200);

      const body = res.body as {
        enabled: boolean;
        defaultTone: string;
        customInstructions: string;
      };
      expect(body.enabled).toBe(false);
    });

    it('returns 200 when restaurant does not exist', async () => {
      await request(server)
        .get('/restaurants/99999/auto-reply')
        .set('Authorization', 'Bearer token')
        .expect(200);
    });
  });

  describe('PATCH /restaurants/:id/auto-reply', () => {
    it('updates auto-reply settings and returns 204', async () => {
      await request(server)
        .patch(`/restaurants/${restaurantId}/auto-reply`)
        .set('Authorization', 'Bearer token')
        .send({ enabled: true, defaultTone: 'professional', customInstructions: 'Be polite' })
        .expect(204);

      const [row] = await sql<{
        auto_reply_enabled: boolean;
        auto_reply_default_tone: string;
        auto_reply_custom_instructions: string;
      }[]>`
        SELECT auto_reply_enabled, auto_reply_default_tone, auto_reply_custom_instructions
        FROM restaurants WHERE id = ${restaurantId}
      `;
      expect(row.auto_reply_enabled).toBe(true);
      expect(row.auto_reply_default_tone).toBe('professional');
      expect(row.auto_reply_custom_instructions).toBe('Be polite');
    });

    it('can disable auto-reply', async () => {
      await sql`
        UPDATE restaurants
        SET auto_reply_enabled = true, auto_reply_default_tone = 'casual'
        WHERE id = ${restaurantId}
      `;

      await request(server)
        .patch(`/restaurants/${restaurantId}/auto-reply`)
        .set('Authorization', 'Bearer token')
        .send({ enabled: false, defaultTone: '', customInstructions: '' })
        .expect(204);

      const [row] = await sql<{ auto_reply_enabled: boolean }[]>`
        SELECT auto_reply_enabled FROM restaurants WHERE id = ${restaurantId}
      `;
      expect(row.auto_reply_enabled).toBe(false);
    });
  });

  describe('GET /restaurants', () => {
    it('returns the seeded restaurant from DB', async () => {
      const res = await request(server)
        .get('/restaurants')
        .set('Authorization', 'Bearer token')
        .expect(200);

      const body = res.body as { restaurants: { name: string }[] };
      expect(body.restaurants).toHaveLength(1);
      expect(body.restaurants[0].name).toBe('Test Bistro');
    });

    it('returns empty list when user has no restaurants', async () => {
      await sql`DELETE FROM restaurants WHERE user_id = ${userId}`;

      const res = await request(server)
        .get('/restaurants')
        .set('Authorization', 'Bearer token')
        .expect(200);

      const body = res.body as { restaurants: unknown[] };
      expect(body.restaurants).toEqual([]);
    });
  });

  describe('POST /restaurants/:id/switch', () => {
    it('switches to a new restaurant and returns 201', async () => {
      const res = await request(server)
        .post(`/restaurants/${restaurantId}/switch`)
        .set('Authorization', 'Bearer token')
        .send({ placeId: 'ChIJ_new_place', name: 'New Bistro', address: '2 New St' })
        .expect(201);

      const body = res.body as { name: string; googlePlaceId: string };
      expect(body.name).toBe('New Bistro');
      expect(body.googlePlaceId).toBe('ChIJ_new_place');
    });

    it('updates the restaurant row in the DB', async () => {
      await request(server)
        .post(`/restaurants/${restaurantId}/switch`)
        .set('Authorization', 'Bearer token')
        .send({ placeId: 'ChIJ_new_place', name: 'New Bistro', address: null })
        .expect(201);

      const [row] = await sql<{ name: string; google_place_id: string; last_synced_at: Date | null }[]>`
        SELECT name, google_place_id, last_synced_at FROM restaurants WHERE id = ${restaurantId}
      `;
      expect(row.name).toBe('New Bistro');
      expect(row.google_place_id).toBe('ChIJ_new_place');
      expect(row.last_synced_at).toBeNull();
    });

    it('deletes all existing reviews', async () => {
      await sql`
        INSERT INTO reviews (restaurant_id, google_review_id, reviewer_name, reviewer_avatar_url, review_text, rating, posted_at, replied)
        VALUES (${restaurantId}, 'rev-001', 'Alice', 'https://example.com/alice.jpg', 'Great!', 5, NOW(), false)
      `;

      await request(server)
        .post(`/restaurants/${restaurantId}/switch`)
        .set('Authorization', 'Bearer token')
        .send({ placeId: 'ChIJ_new_place', name: 'New Bistro', address: null })
        .expect(201);

      const reviews = await sql`SELECT * FROM reviews WHERE restaurant_id = ${restaurantId}`;
      expect(reviews).toHaveLength(0);
    });

    it('sets restaurant_changed_at', async () => {
      const before = new Date();

      await request(server)
        .post(`/restaurants/${restaurantId}/switch`)
        .set('Authorization', 'Bearer token')
        .send({ placeId: 'ChIJ_new_place', name: 'New Bistro', address: null })
        .expect(201);

      const [row] = await sql<{ restaurant_changed_at: Date }[]>`
        SELECT restaurant_changed_at FROM restaurants WHERE id = ${restaurantId}
      `;
      expect(row.restaurant_changed_at.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it('returns 429 when switched within the last 7 days', async () => {
      await sql`
        UPDATE restaurants
        SET restaurant_changed_at = NOW() - INTERVAL '2 days'
        WHERE id = ${restaurantId}
      `;

      const res = await request(server)
        .post(`/restaurants/${restaurantId}/switch`)
        .set('Authorization', 'Bearer token')
        .send({ placeId: 'ChIJ_other', name: 'Other Place', address: null })
        .expect(429);

      expect(res.body.message).toMatch(/day/);
    });

    it('allows switch when 7 days have passed', async () => {
      await sql`
        UPDATE restaurants
        SET restaurant_changed_at = NOW() - INTERVAL '8 days'
        WHERE id = ${restaurantId}
      `;

      await request(server)
        .post(`/restaurants/${restaurantId}/switch`)
        .set('Authorization', 'Bearer token')
        .send({ placeId: 'ChIJ_new_place', name: 'New Bistro', address: null })
        .expect(201);
    });
  });

  describe('GET /restaurants/search', () => {
    it('returns 400 when query is missing', async () => {
      await request(server).get('/restaurants/search').expect(400);
    });

    it('returns search results from Google Places', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            results: [
              {
                name: 'Bella Italia',
                formatted_address: '1 Via Roma',
                rating: 4.5,
                user_ratings_total: 200,
                place_id: 'ChIJ123',
              },
            ],
          }),
      } as unknown as Response);

      const res = await request(server)
        .get('/restaurants/search?q=bella')
        .expect(200);

      const body = res.body as {
        results: { name: string; google_place_id: string }[];
      };
      expect(body.results).toHaveLength(1);
      expect(body.results[0].name).toBe('Bella Italia');
      expect(body.results[0].google_place_id).toBe('ChIJ123');
    });
  });
});
