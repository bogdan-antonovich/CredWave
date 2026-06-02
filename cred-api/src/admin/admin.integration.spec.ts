import { LoggerModule } from 'nestjs-pino';
import { Test } from '@nestjs/testing';
import {
  INestApplication,
  ExecutionContext,
  CanActivate,
} from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'http';
import postgres, { type Sql } from 'postgres';

import { AuthGuard } from '@nestjs/passport';
import { AdminGuard } from '../shared/guards/admin.guard';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AiService } from '../shared/ai.service';

type RestaurantsResponse = {
  restaurants: { name: string; slug: string }[];
};

type AddRestaurantResponse = {
  id: number;
};

type BlocksResponse = {
  blocks: {
    id: number;
    restaurant_name: string;
    reviewer_name: string;
    review_text: string;
    rating: number;
    responses: { text: string; tone: string }[];
  }[];
};

const FAKE_RESPONSES = {
  empathetic: 'We appreciate it!',
  professional: 'Thank you for your feedback.',
  casual: 'Awesome, glad you liked it!',
};

const mockAiService = {
  generateReviewResponses: jest.fn().mockResolvedValue(FAKE_RESPONSES),
};

class MockJwtGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<{ user: { id: string } }>();
    req.user = { id: '1' };
    return true;
  }
}

class MockAdminGuard implements CanActivate {
  canActivate(): boolean {
    return true;
  }
}

describe('Admin (integration)', () => {
  let sql: Sql;
  let app: INestApplication;
  let server: Server;

  beforeAll(() => {
    sql = postgres(global.__DATABASE_URL__);
  });

  afterAll(async () => {
    await sql.end();
  });

  beforeEach(async () => {
    await sql`
      TRUNCATE
        d_responses,
        d_reviews,
        d_restaurants,
        promo_codes
      CASCADE
    `;

    const moduleRef = await Test.createTestingModule({
      imports: [LoggerModule.forRoot({ pinoHttp: { level: 'silent' } })],
      controllers: [AdminController],
      providers: [
        AdminService,
        { provide: 'SQL', useValue: sql },
        { provide: AiService, useValue: mockAiService },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useClass(MockJwtGuard)
      .overrideGuard(AdminGuard)
      .useClass(MockAdminGuard)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();

    server = app.getHttpServer() as Server;
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /admin/restaurants', () => {
    it('returns empty list', async () => {
      const res = await request(server).get('/admin/restaurants').expect(200);

      const body = res.body as RestaurantsResponse;

      expect(body.restaurants).toEqual([]);
    });

    it('returns restaurants', async () => {
      await sql`
        INSERT INTO d_restaurants (name, slug)
        VALUES ('A', 'a'), ('B', 'b')
      `;

      const res = await request(server).get('/admin/restaurants').expect(200);

      const body = res.body as RestaurantsResponse;

      expect(body.restaurants.map((r) => r.slug)).toContain('a');
      expect(body.restaurants.map((r) => r.slug)).toContain('b');
    });
  });

  describe('POST /admin/restaurants', () => {
    it('creates restaurant', async () => {
      const res = await request(server)
        .post('/admin/restaurants')
        .send({ name: 'Test', slug: 'test' })
        .expect(201);

      const body = res.body as AddRestaurantResponse;

      expect(body.id).toBeDefined();

      const rows = await sql`
        SELECT * FROM d_restaurants WHERE slug = 'test'
      `;
      expect(rows).toHaveLength(1);
    });
  });

  describe('DELETE /admin/restaurants/:slug', () => {
    it('deletes restaurant', async () => {
      await sql`
        INSERT INTO d_restaurants (id, name, slug)
        VALUES (1, 'Test', 'test')
      `;

      await request(server).delete('/admin/restaurants/test').expect(204);

      const rows = await sql`
        SELECT * FROM d_restaurants WHERE slug = 'test'
      `;
      expect(rows).toHaveLength(0);
    });

    it('returns 404 if not found', async () => {
      await request(server).delete('/admin/restaurants/none').expect(404);
    });
  });

  describe('GET /admin/restaurants/:slug', () => {
    it('returns blocks', async () => {
      await sql`
        INSERT INTO d_restaurants (id, name, slug)
        VALUES (1, 'Test', 'test')
      `;

      await sql`
        INSERT INTO d_reviews (id, restaurant_id, reviewer_name, review_text, rating)
        VALUES (1, 1, 'Alice', 'Great', 5)
      `;

      await sql`
        INSERT INTO d_responses (review_id, text, tone)
        VALUES (1, 'Thanks', 'friendly')
      `;

      const res = await request(server)
        .get('/admin/restaurants/test')
        .expect(200);

      const body = res.body as BlocksResponse;

      expect(body.blocks).toHaveLength(1);
      expect(body.blocks[0].responses).toHaveLength(1);
    });

    it('returns 404 if restaurant not found', async () => {
      await request(server).get('/admin/restaurants/none').expect(404);
    });
  });

  describe('POST /admin/restaurants/:slug/blocks', () => {
    it('creates block with responses', async () => {
      await sql`
        INSERT INTO d_restaurants (id, name, slug)
        VALUES (1, 'Test', 'test')
      `;

      const payload = {
        reviewerName: 'Alice',
        reviewText: 'Loved it!',
        rating: 5,
        link: 'https://maps.google.com/review/1',
        responses: [
          { text: 'Thanks!', tone: 'friendly' },
          { text: 'We appreciate it.', tone: 'professional' },
        ],
      };

      await request(server)
        .post('/admin/restaurants/test/blocks')
        .send(payload)
        .expect(201);

      const reviews = await sql`SELECT * FROM d_reviews WHERE restaurant_id = 1`;
      expect(reviews).toHaveLength(1);
      expect(reviews[0].reviewer_name).toBe('Alice');

      const responses = await sql`SELECT * FROM d_responses WHERE review_id = ${reviews[0].id}`;
      expect(responses).toHaveLength(2);
    });

    it('returns 404 for unknown slug', async () => {
      await request(server)
        .post('/admin/restaurants/nonexistent/blocks')
        .send({
          reviewerName: 'X',
          reviewText: 'Y',
          rating: 3,
          link: '',
          responses: [],
        })
        .expect(404);
    });
  });

  describe('PUT /admin/blocks/:id', () => {
    it('updates block + replaces responses', async () => {
      await sql`
        INSERT INTO d_restaurants (id, name, slug)
        VALUES (1, 'Test', 'test')
      `;

      await sql`
        INSERT INTO d_reviews (id, restaurant_id, reviewer_name, review_text, rating)
        VALUES (1, 1, 'Old', 'Old text', 2)
      `;

      const payload = {
        reviewerName: 'New',
        reviewText: 'Updated',
        rating: 5,
        responses: [{ text: 'Reply', tone: 'friendly' }],
      };

      await request(server).put('/admin/blocks/1').send(payload).expect(200);

      const reviews = await sql`
        SELECT * FROM d_reviews WHERE id = 1
      `;
      const responses = await sql`
        SELECT * FROM d_responses WHERE review_id = 1
      `;

      expect(reviews[0].reviewer_name).toBe('New');
      expect(responses).toHaveLength(1);
    });
  });

  describe('POST /admin/blocks/generate', () => {
    it('returns AI-generated responses', async () => {
      const payload = {
        restaurantName: 'Pasta Place',
        reviewerName: 'Alice',
        reviewText: 'Great food!',
        rating: 5,
      };

      const res = await request(server)
        .post('/admin/blocks/generate')
        .send(payload)
        .expect(201);

      expect(res.body).toEqual(FAKE_RESPONSES);
      expect(mockAiService.generateReviewResponses).toHaveBeenCalledWith(
        'Pasta Place',
        'Alice',
        5,
        'Great food!',
      );
    });
  });

  describe('DELETE /admin/blocks/:id', () => {
    it('deletes block', async () => {
      await sql`
        INSERT INTO d_restaurants (id, name, slug)
        VALUES (1, 'Test', 'test')
      `;

      await sql`
        INSERT INTO d_reviews (id, restaurant_id, reviewer_name, review_text, rating)
        VALUES (1, 1, 'Alice', 'Review', 5)
      `;

      await request(server).delete('/admin/blocks/1').expect(204);

      const rows = await sql`
        SELECT * FROM d_reviews WHERE id = 1
      `;
      expect(rows).toHaveLength(0);
    });
  });

  describe('POST /admin/promo-codes', () => {
    it('creates promo code and returns 204', async () => {
      await request(server)
        .post('/admin/promo-codes')
        .send({ code: 'LAUNCH20', durationDays: 30 })
        .expect(204);

      const rows = await sql`SELECT * FROM promo_codes WHERE code = 'LAUNCH20'`;
      expect(rows).toHaveLength(1);
      expect(rows[0].duration_days).toBe(30);
      expect(rows[0].is_active).toBe(true);
    });

    it('creates promo code with optional fields', async () => {
      await request(server)
        .post('/admin/promo-codes')
        .send({ code: 'SUMMER', durationDays: 14, maxUses: 50 })
        .expect(204);

      const rows = await sql`SELECT * FROM promo_codes WHERE code = 'SUMMER'`;
      expect(rows).toHaveLength(1);
      expect(Number(rows[0].max_uses)).toBe(50);
    });

    it('returns 500 on duplicate code', async () => {
      await sql`INSERT INTO promo_codes (code, duration_days) VALUES ('DUP', 7)`;

      await request(server)
        .post('/admin/promo-codes')
        .send({ code: 'DUP', durationDays: 7 })
        .expect(500);
    });
  });

  describe('GET /admin/promo-codes', () => {
    it('returns empty array when no codes exist', async () => {
      const res = await request(server).get('/admin/promo-codes').expect(200);
      expect(res.body).toEqual([]);
    });

    it('returns all promo codes in camelCase', async () => {
      await sql`
        INSERT INTO promo_codes (code, duration_days, max_uses, is_active)
        VALUES ('CODE1', 30, NULL, TRUE), ('CODE2', 7, 100, FALSE)
      `;

      const res = await request(server).get('/admin/promo-codes').expect(200);

      const body = res.body as { code: string; durationDays: number; isActive: boolean }[];
      expect(body).toHaveLength(2);

      const codes = body.map((c) => c.code);
      expect(codes).toContain('CODE1');
      expect(codes).toContain('CODE2');

      const code1 = body.find((c) => c.code === 'CODE1')!;
      expect(code1.durationDays).toBe(30);
      expect(code1.isActive).toBe(true);
    });
  });

  describe('DELETE /admin/promo-codes/:code', () => {
    it('deletes promo code and returns 204', async () => {
      await sql`INSERT INTO promo_codes (code, duration_days) VALUES ('TODELETE', 14)`;

      await request(server).delete('/admin/promo-codes/TODELETE').expect(204);

      const rows = await sql`SELECT * FROM promo_codes WHERE code = 'TODELETE'`;
      expect(rows).toHaveLength(0);
    });

    it('nulls promo_code on users who redeemed it', async () => {
      await sql`INSERT INTO promo_codes (code, duration_days) VALUES ('REDEEMED', 30)`;
      const [user] = await sql<{ id: number }[]>`
        INSERT INTO users (email, name) VALUES ('redeemer@test.com', 'Redeemer') RETURNING id
      `;
      await sql`
        UPDATE users
        SET promo_code = 'REDEEMED', promo_access_until = NOW() + INTERVAL '30 days'
        WHERE id = ${user.id}
      `;

      await request(server).delete('/admin/promo-codes/REDEEMED').expect(204);

      const [row] = await sql<{ promo_code: string | null }[]>`
        SELECT promo_code FROM users WHERE id = ${user.id}
      `;
      expect(row.promo_code).toBeNull();
      const codes = await sql`SELECT * FROM promo_codes WHERE code = 'REDEEMED'`;
      expect(codes).toHaveLength(0);
    });

    it('returns 204 even when code does not exist', async () => {
      await request(server).delete('/admin/promo-codes/NONEXISTENT').expect(204);
    });
  });
});
