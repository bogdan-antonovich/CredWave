import { LoggerModule } from 'nestjs-pino';
import { Test } from '@nestjs/testing';
import {
  INestApplication,
  UnauthorizedException,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import request from 'supertest';
import postgres, { type Sql } from 'postgres';
import { AppConfigService } from 'src/config/config.service';
import { GoogleTokensService } from '../auth/auth.service';
import { getLoggerToken } from 'nestjs-pino';
import { AuthGuard } from '@nestjs/passport';
import { google } from 'googleapis';
import type { AuthPlus } from 'googleapis-common';
import type { Credentials } from 'google-auth-library';
import type { GaxiosOptions, GaxiosResponse } from 'gaxios';
import type OpenAI from 'openai';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { EmailService } from '../email/email.serivice';
import type { Server } from 'http';

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

type CreateFn = OpenAI['chat']['completions']['create'];

const mockCreate = jest.fn<ReturnType<CreateFn>, Parameters<CreateFn>>();
const openaiMock: { chat: { completions: { create: typeof mockCreate } } } = {
  chat: { completions: { create: mockCreate } },
};

const mockAuthRequest = jest.fn<
  Promise<GaxiosResponse<unknown>>,
  [GaxiosOptions]
>();
const mockSetCredentials = jest.fn<void, [Credentials]>();

jest.mock('googleapis', () => ({
  google: { auth: { OAuth2: jest.fn() } },
}));

const mockedAuth = google.auth as jest.Mocked<AuthPlus>;

const FAKE_RESPONSES = {
  empathetic: 'We really appreciate your kind words!',
  professional: 'Thank you for your valuable feedback.',
  casual: 'Awesome, glad you enjoyed it!',
};

describe('/reviews route', () => {
  let sql: Sql;
  let app: INestApplication;
  let server: Server;

  // Seeded IDs
  let restaurantId: number;
  let userId: number;
  let reviewId: number;

  beforeAll(() => {
    sql = postgres(global.__DATABASE_URL__);
  });

  afterAll(async () => {
    await sql.end();
  });

  beforeEach(async () => {
    // Reset mocks
    jest.resetAllMocks();
    jest.spyOn(mockedAuth, 'OAuth2').mockImplementation(
      () =>
        ({
          setCredentials: mockSetCredentials,
          request: mockAuthRequest,
        }) as unknown as InstanceType<typeof mockedAuth.OAuth2>,
    );

    // Clean tables between tests
    await sql`TRUNCATE responses, reviews, gl_access_tokens, restaurants, users CASCADE`;

    // Seed a restaurant + user
    const [user] = await sql<{ id: number }[]>`
      INSERT INTO users (email, name, picture_url)
      VALUES ('test@example.com', 'Test User', 'https://img.com/pic.png')
      RETURNING id
    `;
    userId = user.id;
    const [restaurant] = await sql<{ id: number }[]>`
      INSERT INTO restaurants (name, additional_info, user_id, google_account_id, google_location_id)
      VALUES ('Pasta Place', 'Family friendly Italian', ${userId}, 'accounts/123', 'locations/456')
      RETURNING id
    `;
    restaurantId = restaurant.id;

    // Seed a review
    const [review] = await sql<{ id: number }[]>`
      INSERT INTO reviews (restaurant_id, review_text, rating, reviewer_name, google_review_id, reviewer_avatar_url, posted_at, replied)
      VALUES (${restaurantId}, 'Great food!', 5, 'Alice', 'google-review-abc', '', NOW(), false)
      RETURNING id
    `;
    reviewId = review.id;

    // Seed an access token
    await sql`
      INSERT INTO gl_access_tokens (user_id, token, expires_at)
      VALUES (${userId}, 'ya29.fake-token', NOW() + INTERVAL '1 hour')
    `;

    // Build NestJS app
    const moduleRef = await Test.createTestingModule({
      imports: [LoggerModule.forRoot({ pinoHttp: { level: 'silent' } })],
      controllers: [ReviewsController],
      providers: [
        ReviewsService,
        GoogleTokensService,
        { provide: 'SQL', useValue: sql },
        { provide: 'OPENAI', useValue: openaiMock },
        { provide: EmailService, useValue: { sendReplyPosted: jest.fn(), sendAutoReply: jest.fn() } },
        {
          provide: AppConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'openai') return { model: 'gpt-4o' };
              if (key === 'google') return { clientId: '', clientSecret: '' };
              throw new Error(`Unknown config key: ${key}`);
            },
          },
        },
        {
          provide: getLoggerToken(GoogleTokensService.name),
          useValue: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), trace: jest.fn() },
        },
        {
          provide: getLoggerToken(ReviewsService.name),
          useValue: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), trace: jest.fn() },
        },
        {
          provide: getLoggerToken(ReviewsController.name),
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

  describe('POST /reviews/:id/generate', () => {
    it('returns 404 when review does not exist', async () => {
      await request(server)
        .post('/reviews/999999/generate')
        .set('Authorization', `Bearer ${userId}`)
        .send({})
        .expect(404);
    });

    it('returns generated responses and persists them to the responses table', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              refusal: null,
              content: JSON.stringify(FAKE_RESPONSES),
            },
          },
        ],
      } as Awaited<ReturnType<CreateFn>>);

      const { body } = (await request(server)
        .post(`/reviews/${reviewId}/generate`)
        .set('Authorization', `Bearer ${userId}`)
        .send({})
        .expect(201)) as {
        body: { responses: typeof FAKE_RESPONSES; generated_at: string };
      };

      expect(body.responses).toEqual(FAKE_RESPONSES);
      expect(body.generated_at).toBeDefined();

      // Verify it was actually written to the DB
      const [row] = await sql<{ response_json: typeof FAKE_RESPONSES }[]>`
        SELECT response_json FROM responses WHERE review_id = ${reviewId}
      `;
      expect(row).toBeDefined();
      expect(row.response_json).toEqual(FAKE_RESPONSES);
    });

    it('passes restaurant name and review text to OpenAI', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              refusal: null,
              content: JSON.stringify(FAKE_RESPONSES),
            },
          },
        ],
      } as Awaited<ReturnType<CreateFn>>);

      await request(server)
        .post(`/reviews/${reviewId}/generate`)
        .set('Authorization', `Bearer ${userId}`)
        .send({})
        .expect(201);

      const prompt = mockCreate.mock.calls[0][0].messages[0].content as string;
      expect(prompt).toContain('Pasta Place');
      expect(prompt).toContain('Great food!');
      expect(prompt).toContain('Family friendly Italian');
    });

    it('passes additionalContext to OpenAI when provided', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              refusal: null,
              content: JSON.stringify(FAKE_RESPONSES),
            },
          },
        ],
      } as Awaited<ReturnType<CreateFn>>);

      await request(server)
        .post(`/reviews/${reviewId}/generate`)
        .set('Authorization', `Bearer ${userId}`)
        .send({ additionalContext: 'Customer is a VIP' })
        .expect(201);

      const prompt = mockCreate.mock.calls[0][0].messages[0].content as string;
      expect(prompt).toContain('Customer is a VIP');
    });

    it('overwrites existing response on second generate call', async () => {
      // First call
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              refusal: null,
              content: JSON.stringify(FAKE_RESPONSES),
            },
          },
        ],
      } as Awaited<ReturnType<CreateFn>>);
      await request(server)
        .post(`/reviews/${reviewId}/generate`)
        .set('Authorization', `Bearer ${userId}`)
        .send({})
        .expect(201);

      const updatedResponses = {
        empathetic: 'Updated empathetic',
        professional: 'Updated professional',
        casual: 'Updated casual',
      };

      // Second call
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              refusal: null,
              content: JSON.stringify(updatedResponses),
            },
          },
        ],
      } as Awaited<ReturnType<CreateFn>>);
      await request(server)
        .post(`/reviews/${reviewId}/generate`)
        .set('Authorization', `Bearer ${userId}`)
        .send({})
        .expect(201);

      // Only one row should exist
      const rows =
        await sql`SELECT * FROM responses WHERE review_id = ${reviewId}`;
      expect(rows).toHaveLength(1);
      expect(rows[0].response_json).toEqual(updatedResponses);
    });
  });

  describe('POST /reviews/:id/reply', () => {
    it('returns 401 when no JWT is provided', async () => {
      await request(server)
        .post(`/reviews/${reviewId}/reply`)
        .send({ text: 'Thank you!' })
        .expect(401);
    });

    it('returns 404 when review does not exist', async () => {
      await request(server)
        .post('/reviews/999999/reply')
        .set('Authorization', `Bearer ${userId}`)
        .send({ text: 'Thank you!' })
        .expect(404);
    });

    it('calls the Google My Business API with the correct URL and body', async () => {
      mockAuthRequest.mockResolvedValueOnce({
        data: {},
        status: 200,
      } as GaxiosResponse<unknown>);

      await request(server)
        .post(`/reviews/${reviewId}/reply`)
        .set('Authorization', `Bearer ${userId}`)
        .send({ text: 'Thank you!' })
        .expect(201);

      expect(mockAuthRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ comment: 'Thank you!' }),
          url: expect.stringContaining('google-review-abc/reply') as string,
        }),
      );
    });

    it('persists replied flag, reply text and replied_at to the database', async () => {
      mockAuthRequest.mockResolvedValueOnce({
        data: {},
        status: 200,
      } as GaxiosResponse<unknown>);

      await request(server)
        .post(`/reviews/${reviewId}/reply`)
        .set('Authorization', `Bearer ${userId}`)
        .send({ text: 'Thank you!' })
        .expect(201);

      const [row] = await sql<
        {
          replied: boolean;
          reply_text: string;
          replied_at: Date;
        }[]
      >`
        SELECT replied, reply_text, replied_at FROM reviews WHERE id = ${reviewId}
      `;
      expect(row.replied).toBe(true);
      expect(row.reply_text).toBe('Thank you!');
      expect(row.replied_at).toBeDefined();
    });

    it('does not persist reply when Google API call fails', async () => {
      mockAuthRequest.mockRejectedValueOnce(new Error('401 Unauthorized'));

      await request(server)
        .post(`/reviews/${reviewId}/reply`)
        .set('Authorization', `Bearer ${userId}`)
        .send({ text: 'Thank you!' })
        .expect(500);

      const [row] = await sql<{ replied: boolean }[]>`
        SELECT replied FROM reviews WHERE id = ${reviewId}
      `;
      expect(row.replied).toBe(false);
    });

    it('passes the correct access token to Google OAuth client', async () => {
      mockAuthRequest.mockResolvedValueOnce({
        data: {},
        status: 200,
      } as GaxiosResponse<unknown>);

      await request(server)
        .post(`/reviews/${reviewId}/reply`)
        .set('Authorization', `Bearer ${userId}`)
        .send({ text: 'Thank you!' })
        .expect(201);

      expect(mockSetCredentials).toHaveBeenCalledWith({
        access_token: 'ya29.fake-token',
      });
    });
  });
});
