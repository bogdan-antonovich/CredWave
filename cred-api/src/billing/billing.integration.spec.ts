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
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { AppConfigService } from '../config/config.service';
import { EmailService } from '../email/email.serivice';

type SubscriptionResponse = {
  plan: {
    name: string;
    price: number;
    period: string;
    status: string;
    nextBillingDate: string;
    paddleSubscriptionId: string;
  };
  usage: {
    reviewsUsed: number;
    reviewsLimit: number;
  };
  paymentMethod: unknown;
};

type InvoicesResponse = {
  invoices: {
    id: string;
    paddle_invoice_id: string;
    date: string;
    amount: number;
    currency: string;
    status: string;
    download_url: string;
  }[];
};

type PortalResponse = { url: string };
type WebhookResponse = { received: boolean };

class MockAuthGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<{ user: { id: string } }>();
    req.user = { id: '1' };
    return true;
  }
}

const mockPortalCreate = jest.fn();
const mockUnmarshal = jest.fn();

const mockPaddle = {
  customerPortalSessions: {
    create: mockPortalCreate,
  },
  webhooks: {
    unmarshal: mockUnmarshal,
  },
};

describe('/billing route', () => {
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
    jest.resetAllMocks();

    await sql`
      TRUNCATE
        subscriptions,
        payment_methods,
        invoices,
        users,
        reviews,
        restaurants
      CASCADE
    `;

    await sql`
      INSERT INTO users (id, email, name, paddle_customer_id)
      VALUES (1, 'test@test.com', 'Test User', 'cust_123')
    `;

    const moduleRef = await Test.createTestingModule({
      imports: [LoggerModule.forRoot({ pinoHttp: { level: 'silent' } })],
      controllers: [BillingController],
      providers: [
        BillingService,
        { provide: 'SQL', useValue: sql },
        { provide: 'PADDLE', useValue: mockPaddle },
        {
          provide: EmailService,
          useValue: {
            sendSubscriptionStarted: jest.fn(),
            sendSubscriptionRenewed: jest.fn(),
            sendSubscriptionCanceled: jest.fn(),
            sendPaymentFailed: jest.fn(),
          },
        },
        {
          provide: AppConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'paddle') return { webhookSecret: 'secret' };
              throw new Error(`Unknown key ${key}`);
            },
          },
        },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useClass(MockAuthGuard)
      .compile();

    app = moduleRef.createNestApplication({ rawBody: true });
    await app.init();

    server = app.getHttpServer() as Server;
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /billing/subscription', () => {
    it('returns 404 if no subscription', async () => {
      await request(server).get('/billing/subscription').expect(404);
    });

    it('returns subscription', async () => {
      await sql`
        INSERT INTO subscriptions (
          user_id, plan_name, price, period, status,
          current_period_end, paddle_subscription_id, reviews_limit
        )
        VALUES (
          1, 'starter', 10, 'month', 'active',
          NOW() + INTERVAL '1 month', 'sub_123', 50
        )
      `;

      const res = await request(server)
        .get('/billing/subscription')
        .expect(200);

      const body = res.body as SubscriptionResponse;

      expect(body.plan.name).toBe('starter');
      expect(body.usage.reviewsLimit).toBe(50);
    });

    it('returns 404 when subscription is canceled and period has expired', async () => {
      await sql`
        INSERT INTO subscriptions (
          user_id, plan_name, price, period, status,
          current_period_end, paddle_subscription_id, reviews_limit
        )
        VALUES (
          1, 'starter', 10, 'month', 'canceled',
          NOW() - INTERVAL '1 day', 'sub_expired', 50
        )
      `;

      await request(server).get('/billing/subscription').expect(404);
    });

    it('returns 200 when subscription is canceled but period has not expired yet', async () => {
      await sql`
        INSERT INTO subscriptions (
          user_id, plan_name, price, period, status,
          current_period_end, paddle_subscription_id, reviews_limit
        )
        VALUES (
          1, 'starter', 10, 'month', 'canceled',
          NOW() + INTERVAL '5 days', 'sub_canceling', 50
        )
      `;

      await request(server).get('/billing/subscription').expect(200);
    });
  });

  describe('GET /billing/invoices', () => {
    it('returns empty invoices', async () => {
      const res = await request(server).get('/billing/invoices').expect(200);

      const body = res.body as InvoicesResponse;

      expect(body.invoices).toEqual([]);
    });

    it('returns invoices', async () => {
      await sql`
        INSERT INTO invoices (
          user_id, paddle_invoice_id, amount, currency, status, download_url
        )
        VALUES
        (1, 'inv1', 10, 'USD', 'paid', 'url1'),
        (1, 'inv2', 20, 'USD', 'paid', 'url2')
      `;

      const res = await request(server).get('/billing/invoices').expect(200);

      const body = res.body as InvoicesResponse;

      expect(body.invoices.length).toBe(2);
    });
  });

  describe('POST /billing/portal', () => {
    it('returns portal url', async () => {
      mockPortalCreate.mockResolvedValueOnce({
        urls: { general: { overview: 'https://portal.url' } },
      });

      const res = await request(server).post('/billing/portal').expect(201);

      const body = res.body as PortalResponse;

      expect(body.url).toBe('https://portal.url');
    });

    it('returns 404 if no customer id', async () => {
      await sql`UPDATE users SET paddle_customer_id = NULL WHERE id = 1`;

      await request(server).post('/billing/portal').expect(404);
    });
  });

  describe('POST /billing/webhooks/paddle', () => {
    it('returns 401 on invalid signature', async () => {
      mockUnmarshal.mockImplementationOnce(() => {
        throw new Error('invalid');
      });

      await request(server)
        .post('/billing/webhooks/paddle')
        .set('paddle-signature', 'bad')
        .send({})
        .expect(401);
    });

    it('handles subscription.created', async () => {
      mockUnmarshal.mockResolvedValueOnce({
        eventType: 'subscription.created',
        data: {
          id: 'sub_123',
          customerId: 'cust_123',
          customData: { userId: '1' },
          status: 'active',
          billingCycle: { interval: 'month' },
          items: [{ price: { name: 'Starter', unitPrice: { amount: '10' } } }],
          currentBillingPeriod: { endsAt: new Date() },
        },
      });

      const res = await request(server)
        .post('/billing/webhooks/paddle')
        .set('paddle-signature', 'ok')
        .send({})
        .expect(201);

      const body = res.body as WebhookResponse;

      expect(body.received).toBe(true);
    });
  });
});
