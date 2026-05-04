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
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

class MockJwtGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx
      .switchToHttp()
      .getRequest<{ headers: Record<string, string>; user: { id: string } }>();
    if (!req.headers['authorization']) throw new UnauthorizedException();
    req.user = { id: req.headers['authorization'].split(' ')[1] };
    return true;
  }
}

global.fetch = jest.fn();

const mockFetch = global.fetch as jest.Mock;

describe('/users route', () => {
  let sql: Sql;
  let app: INestApplication;
  let server: Server;

  let userId: number;

  beforeAll(() => {
    sql = postgres(global.__DATABASE_URL__);
  });

  afterAll(async () => {
    await sql.end();
  });

  beforeEach(async () => {
    jest.resetAllMocks();

    // clean DB
    await sql`
      TRUNCATE
        gl_access_tokens,
        users
      CASCADE
    `;

    // seed user
    const [user] = await sql<{ id: number }[]>`
      INSERT INTO users (email, name, picture_url)
      VALUES ('test@example.com', 'Test User', 'https://img.com/pic.png')
      RETURNING id
    `;
    userId = user.id;

    // seed google token
    await sql`
      INSERT INTO gl_access_tokens (user_id, token, expires_at)
      VALUES (${userId}, 'valid-google-token', NOW() + INTERVAL '1 hour')
    `;

    // build app
    const moduleRef = await Test.createTestingModule({
      imports: [LoggerModule.forRoot({ pinoHttp: { level: 'silent' } })],
      controllers: [UsersController],
      providers: [UsersService, { provide: 'SQL', useValue: sql }],
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

  describe('GET /users/me', () => {
    it('returns 401 when no JWT is provided', async () => {
      await request(server).get('/users/me').expect(401);
    });

    it('returns user + google token validity = true', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      const res = await request(server)
        .get('/users/me')
        .set('Authorization', `Bearer ${userId}`)
        .expect(200);

      expect(res.body).toEqual(
        expect.objectContaining({
          id: userId,
          email: 'test@example.com',
          name: 'Test User',
          picture_url: 'https://img.com/pic.png',
          google_access_token_valid: true,
        }),
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('tokeninfo'),
      );
    });

    type GetMeResponse = {
      id: number;
      email: string;
      name: string;
      picture_url: string;
      created_at: string;
      google_access_token_valid: boolean;
    };

    it('returns google_access_token_valid = false when API returns invalid', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      const res = await request(server)
        .get('/users/me')
        .set('Authorization', `Bearer ${userId}`)
        .expect(200);

      const body = res.body as GetMeResponse;

      expect(body.google_access_token_valid).toBe(false);
    });

    it('throws 404 when user does not exist', async () => {
      await request(server)
        .get('/users/me')
        .set('Authorization', 'Bearer 999999')
        .expect(404);
    });

    it('throws 404 when google token is missing', async () => {
      await sql`DELETE FROM gl_access_tokens WHERE user_id = ${userId}`;

      await request(server)
        .get('/users/me')
        .set('Authorization', `Bearer ${userId}`)
        .expect(404);
    });

    it('throws 500 when Google token validation fails (fetch throws)', async () => {
      mockFetch.mockRejectedValueOnce(new Error('network error'));

      await request(server)
        .get('/users/me')
        .set('Authorization', `Bearer ${userId}`)
        .expect(500);
    });
  });

  describe('UsersService (DB logic)', () => {
    let service: UsersService;

    beforeEach(() => {
      service = new UsersService(sql);
    });

    it('getUserbyId returns user', async () => {
      const user = await service.getUserbyId(String(userId));

      expect(user).toEqual(
        expect.objectContaining({
          id: userId,
          email: 'test@example.com',
        }),
      );
    });

    it('getGoogleAccessTokenByUserId returns token', async () => {
      const token = await service.getGoogleAccessTokenByUserId(String(userId));

      expect(token).toBe('valid-google-token');
    });

    it('isGoogleTokenValid returns true', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const result = await service.isGoogleTokenValid('token');
      expect(result).toBe(true);
    });

    it('isGoogleTokenValid returns false', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      const result = await service.isGoogleTokenValid('token');
      expect(result).toBe(false);
    });
  });
});
