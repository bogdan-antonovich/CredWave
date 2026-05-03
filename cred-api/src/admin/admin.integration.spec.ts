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

type RestaurantsResponse = {
  restaurants: string[];
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
        d_restaurants
      CASCADE
    `;

    const moduleRef = await Test.createTestingModule({
      imports: [LoggerModule.forRoot({ pinoHttp: { level: 'silent' } })],
      controllers: [AdminController],
      providers: [AdminService, { provide: 'SQL', useValue: sql }],
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

      expect(body.restaurants).toContain('a');
      expect(body.restaurants).toContain('b');
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
});
