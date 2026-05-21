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
