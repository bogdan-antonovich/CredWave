import { ExecutionContext, CanActivate, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthGuard } from '@nestjs/passport';
import { LoggerModule } from 'nestjs-pino';
import postgres, { type Sql } from 'postgres';
import request from 'supertest';
import type { Server } from 'http';
import { PromoController } from './promo.controller';
import { PromoService } from './promo.service';

class MockAuthGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<{ user: { id: string } }>();
    req.user = { id: '1' };
    return true;
  }
}

describe('/promo route (integration)', () => {
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
    await sql`TRUNCATE promo_codes CASCADE`;
    await sql`TRUNCATE users CASCADE`;

    await sql`
      INSERT INTO users (id, email, name)
      VALUES (1, 'user@test.com', 'Test User')
    `;

    const moduleRef = await Test.createTestingModule({
      imports: [LoggerModule.forRoot({ pinoHttp: { level: 'silent' } })],
      controllers: [PromoController],
      providers: [
        PromoService,
        { provide: 'SQL', useValue: sql },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useClass(MockAuthGuard)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /promo/redeem', () => {
    it('returns 204 on successful redemption', async () => {
      await sql`
        INSERT INTO promo_codes (code, duration_days, is_active)
        VALUES ('VALID30', 30, TRUE)
      `;

      await request(server)
        .post('/promo/redeem')
        .send({ promoCode: 'VALID30' })
        .expect(204);
    });

    it('sets promo_code and promo_access_until on the user', async () => {
      await sql`
        INSERT INTO promo_codes (code, duration_days, is_active)
        VALUES ('VALID30', 30, TRUE)
      `;

      await request(server)
        .post('/promo/redeem')
        .send({ promoCode: 'VALID30' })
        .expect(204);

      const [user] = await sql<{ promo_code: string; promo_access_until: Date }[]>`
        SELECT promo_code, promo_access_until FROM users WHERE id = 1
      `;
      expect(user.promo_code).toBe('VALID30');
      expect(user.promo_access_until).toBeTruthy();
    });

    it('increments use_count on the promo code', async () => {
      await sql`
        INSERT INTO promo_codes (code, duration_days, is_active, use_count)
        VALUES ('COUNTER', 14, TRUE, 0)
      `;

      await request(server)
        .post('/promo/redeem')
        .send({ promoCode: 'COUNTER' })
        .expect(204);

      const [row] = await sql<{ use_count: number }[]>`
        SELECT use_count FROM promo_codes WHERE code = 'COUNTER'
      `;
      expect(Number(row.use_count)).toBe(1);
    });

    it('returns 400 when code does not exist', async () => {
      await request(server)
        .post('/promo/redeem')
        .send({ promoCode: 'NONEXISTENT' })
        .expect(400);
    });

    it('returns 400 when code is inactive', async () => {
      await sql`
        INSERT INTO promo_codes (code, duration_days, is_active)
        VALUES ('INACTIVE', 30, FALSE)
      `;

      await request(server)
        .post('/promo/redeem')
        .send({ promoCode: 'INACTIVE' })
        .expect(400);
    });

    it('returns 400 when code is expired', async () => {
      await sql`
        INSERT INTO promo_codes (code, duration_days, is_active, expires_at)
        VALUES ('EXPIRED', 30, TRUE, NOW() - INTERVAL '1 day')
      `;

      await request(server)
        .post('/promo/redeem')
        .send({ promoCode: 'EXPIRED' })
        .expect(400);
    });

    it('returns 400 when max_uses is exhausted', async () => {
      await sql`
        INSERT INTO promo_codes (code, duration_days, is_active, max_uses, use_count)
        VALUES ('MAXED', 30, TRUE, 5, 5)
      `;

      await request(server)
        .post('/promo/redeem')
        .send({ promoCode: 'MAXED' })
        .expect(400);
    });

    it('returns 400 when user has already redeemed a code', async () => {
      await sql`
        INSERT INTO promo_codes (code, duration_days, is_active)
        VALUES ('FIRST', 30, TRUE), ('SECOND', 30, TRUE)
      `;
      await sql`
        UPDATE users
        SET promo_code = 'FIRST', promo_access_until = NOW() + INTERVAL '30 days'
        WHERE id = 1
      `;

      await request(server)
        .post('/promo/redeem')
        .send({ promoCode: 'SECOND' })
        .expect(400);
    });

    it('does not modify use_count when redemption is rejected', async () => {
      await sql`
        INSERT INTO promo_codes (code, duration_days, is_active)
        VALUES ('INTACT', 30, FALSE)
      `;

      await request(server)
        .post('/promo/redeem')
        .send({ promoCode: 'INTACT' })
        .expect(400);

      const [row] = await sql<{ use_count: number }[]>`
        SELECT use_count FROM promo_codes WHERE code = 'INTACT'
      `;
      expect(Number(row.use_count)).toBe(0);
    });
  });
});
