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
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '@nestjs/passport';
import { AppConfigService } from '../config/config.service';
import { EmailService } from '../email/email.serivice';
import { AuthController } from './auth.controller';
import {
  AppTokensService,
  GoogleTokensService,
  AuthService,
} from './auth.service';

type AuthResponse = {
  access_token: string;
  refresh_token: string;
};

class MockGoogleGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<{
      user: {
        email: string;
        name: string;
        pictureUrl: string;
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
      };
    }>();

    req.user = {
      email: 'test@example.com',
      name: 'Test',
      pictureUrl: 'pic',
      accessToken: 'google-access',
      refreshToken: 'google-refresh',
      expiresIn: 3600,
    };

    return true;
  }
}

class MockJwtGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<{ user: { id: string } }>();
    req.user = { id: '1' };
    return true;
  }
}

describe('/auth route', () => {
  let sql: Sql;
  let app: INestApplication;
  let server: Server;
  let jwt: JwtService;

  beforeAll(() => {
    sql = postgres(global.__DATABASE_URL__);
  });

  afterAll(async () => {
    await sql.end();
  });

  beforeEach(async () => {
    await sql`
      TRUNCATE
        users,
        auth_tokens,
        gl_access_tokens,
        gl_refresh_tokens,
        blacklisted_tokens
      CASCADE
    `;

    const moduleRef = await Test.createTestingModule({
      imports: [LoggerModule.forRoot({ pinoHttp: { level: 'silent' } })],
      controllers: [AuthController],
      providers: [
        AuthService,
        AppTokensService,
        GoogleTokensService,
        JwtService,
        { provide: 'SQL', useValue: sql },
        { provide: 'JWT_MODULE_OPTIONS', useValue: { secret: 'test-secret' } },
        {
          provide: EmailService,
          useValue: { sendWelcome: jest.fn(), sendNewLogin: jest.fn() },
        },
        {
          provide: AppConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'frontendUrl') return 'http://localhost:5173';
              if (key === 'jwt') return { expiresIn: '7d' };
              return null;
            },
          },
        },
      ],
    })
      .overrideGuard(AuthGuard('google'))
      .useClass(MockGoogleGuard)
      .overrideGuard(AuthGuard('jwt'))
      .useClass(MockJwtGuard)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();

    server = app.getHttpServer() as Server;
    jwt = app.get(JwtService);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /auth/google/callback', () => {
    it('creates user, saves tokens, redirects with JWT pair', async () => {
      const res = await request(server)
        .get('/auth/google/callback')
        .redirects(0)
        .expect(302);

      const location = res.headers['location'] as string;
      expect(location).toContain('http://localhost:5173/auth/callback');

      const url = new URL(location);
      expect(url.searchParams.get('access_token')).toBeTruthy();
      expect(url.searchParams.get('refresh_token')).toBeTruthy();

      const users = await sql`SELECT * FROM users`;
      expect(users).toHaveLength(1);

      const glAccess = await sql`SELECT * FROM gl_access_tokens`;
      expect(glAccess).toHaveLength(1);

      const glRefresh = await sql`SELECT * FROM gl_refresh_tokens`;
      expect(glRefresh).toHaveLength(1);

      const authTokens = await sql`SELECT * FROM auth_tokens`;
      expect(authTokens).toHaveLength(1);
    });
  });

  describe('POST /auth/signout', () => {
    it('blacklists token', async () => {
      const token = jwt.sign({ sub: 1 }, { expiresIn: '1h' });

      await request(server)
        .post('/auth/signout')
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      const rows = await sql`
        SELECT * FROM blacklisted_tokens WHERE token = ${token}
      `;

      expect(rows).toHaveLength(1);
    });
  });

  describe('POST /auth/refresh', () => {
    it('returns new tokens', async () => {
      await sql`
        INSERT INTO users (id, email, name)
        VALUES (1, 'test@test.com', 'Test User')
      `;

      await sql`
        INSERT INTO auth_tokens (user_id, refresh_token)
        VALUES (1, 'valid-refresh')
      `;

      const res = await request(server)
        .post('/auth/refresh')
        .set('Authorization', 'Bearer valid-refresh')
        .expect(200);

      const body = res.body as AuthResponse;

      expect(body.access_token).toBeDefined();
      expect(body.refresh_token).toBeDefined();
    });

    it('returns 401 for invalid refresh token', async () => {
      await request(server)
        .post('/auth/refresh')
        .set('Authorization', 'Bearer invalid')
        .expect(401);
    });

    it('returns 401 if no token provided', async () => {
      await request(server).post('/auth/refresh').expect(500);
    });
  });
});
