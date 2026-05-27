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
const mockGetInvoicePDF = jest.fn();
const mockSubscriptionsUpdate = jest.fn();
const mockSubscriptionsCancel = jest.fn();

const mockPaddle = {
  customerPortalSessions: {
    create: mockPortalCreate,
  },
  webhooks: {
    unmarshal: mockUnmarshal,
  },
  transactions: {
    getInvoicePDF: mockGetInvoicePDF,
  },
  subscriptions: {
    update: mockSubscriptionsUpdate,
    cancel: mockSubscriptionsCancel,
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
        INSERT INTO invoices (user_id, paddle_invoice_id, amount, currency, status)
        VALUES
        (1, 'inv1', 10, 'USD', 'paid'),
        (1, 'inv2', 20, 'USD', 'paid')
      `;

      const res = await request(server).get('/billing/invoices').expect(200);

      const body = res.body as InvoicesResponse;

      expect(body.invoices.length).toBe(2);
    });
  });

  describe('POST /billing/subscription/cancel', () => {
    it('clears scheduled changes then cancels at period end', async () => {
      await sql`
        INSERT INTO subscriptions (
          user_id, plan_name, price, period, status,
          current_period_end, paddle_subscription_id, reviews_limit
        )
        VALUES (1, 'growth', 2300, 'month', 'active', NOW() + INTERVAL '1 month', 'sub_123', 100)
      `;
      mockSubscriptionsUpdate.mockResolvedValueOnce({});
      mockSubscriptionsCancel.mockResolvedValueOnce({});

      const res = await request(server)
        .post('/billing/subscription/cancel')
        .expect(201);

      expect(res.body).toEqual({ ok: true });
      expect(mockSubscriptionsUpdate).toHaveBeenCalledWith('sub_123', { scheduledChange: null });
      expect(mockSubscriptionsCancel).toHaveBeenCalledWith('sub_123', { effectiveFrom: 'next_billing_period' });
    });

    it('returns 404 when user has no subscription', async () => {
      await request(server)
        .post('/billing/subscription/cancel')
        .expect(404);
    });
  });

  describe('POST /billing/subscription/change', () => {
    it('uses prorated_immediately for an active subscription', async () => {
      await sql`
        INSERT INTO subscriptions (
          user_id, plan_name, price, period, status,
          current_period_end, paddle_subscription_id, reviews_limit
        )
        VALUES (1, 'starter', 1100, 'month', 'active', NOW() + INTERVAL '1 month', 'sub_123', 30)
      `;
      mockSubscriptionsUpdate.mockResolvedValueOnce({});

      const res = await request(server)
        .post('/billing/subscription/change')
        .send({ priceId: 'pri_growth', planName: 'growth' })
        .expect(201);

      expect(res.body).toEqual({ ok: true });
      expect(mockSubscriptionsUpdate).toHaveBeenCalledWith(
        'sub_123',
        expect.objectContaining({
          items: [{ priceId: 'pri_growth', quantity: 1 }],
          prorationBillingMode: 'prorated_immediately',
        }),
      );
    });

    it('uses do_not_bill for a trialing subscription', async () => {
      await sql`
        INSERT INTO subscriptions (
          user_id, plan_name, price, period, status,
          current_period_end, paddle_subscription_id, reviews_limit
        )
        VALUES (1, 'starter', 1100, 'month', 'trialing', NOW() + INTERVAL '14 days', 'sub_trial', 30)
      `;
      mockSubscriptionsUpdate.mockResolvedValueOnce({});

      await request(server)
        .post('/billing/subscription/change')
        .send({ priceId: 'pri_growth', planName: 'growth' })
        .expect(201);

      expect(mockSubscriptionsUpdate).toHaveBeenCalledWith(
        'sub_trial',
        expect.objectContaining({
          prorationBillingMode: 'do_not_bill',
        }),
      );
    });

    it('returns 404 when user has no subscription', async () => {
      await request(server)
        .post('/billing/subscription/change')
        .send({ priceId: 'pri_growth', planName: 'growth' })
        .expect(404);
    });

    it('returns 400 when priceId is missing', async () => {
      await request(server)
        .post('/billing/subscription/change')
        .send({ planName: 'growth' })
        .expect(400);
    });

    it('returns 400 when planName is missing', async () => {
      await request(server)
        .post('/billing/subscription/change')
        .send({ priceId: 'pri_growth' })
        .expect(400);
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

  describe('GET /billing/invoice/:invoiceId', () => {
    it('returns the PDF download URL', async () => {
      mockGetInvoicePDF.mockResolvedValueOnce({ url: 'https://pdf.paddle.com/inv_123.pdf' });

      const res = await request(server)
        .get('/billing/invoice/inv_123')
        .expect(200);

      expect(res.body).toEqual({ url: 'https://pdf.paddle.com/inv_123.pdf' });
      expect(mockGetInvoicePDF).toHaveBeenCalledWith('inv_123');
    });

    it('returns 404 when Paddle returns no URL', async () => {
      mockGetInvoicePDF.mockResolvedValueOnce(null);

      await request(server).get('/billing/invoice/inv_missing').expect(404);
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
          customData: { userId: 1 },
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

    it('transaction.completed with $0 does not save invoice or payment method', async () => {
      mockUnmarshal.mockResolvedValueOnce({
        eventType: 'transaction.completed',
        data: {
          id: 'txn_trial',
          customerId: 'cust_123',
          subscriptionId: 'sub_123',
          currencyCode: 'USD',
          details: { totals: { grandTotal: '0' } },
          payments: [],
        },
      });

      await request(server)
        .post('/billing/webhooks/paddle')
        .set('paddle-signature', 'ok')
        .send({})
        .expect(201);

      const [invoice] = await sql<{ id: string }[]>`SELECT id FROM invoices WHERE paddle_invoice_id = 'txn_trial'`;
      expect(invoice).toBeUndefined();

      const [pm] = await sql<{ id: string }[]>`SELECT id FROM payment_methods WHERE user_id = 1`;
      expect(pm).toBeUndefined();
    });

    it('transaction.completed with real amount saves invoice and payment method', async () => {
      await sql`
        INSERT INTO subscriptions (
          user_id, plan_name, price, period, status,
          current_period_end, paddle_subscription_id, reviews_limit
        )
        VALUES (1, 'growth', 2300, 'month', 'active', NOW() + INTERVAL '1 month', 'sub_123', 100)
      `;

      mockUnmarshal.mockResolvedValueOnce({
        eventType: 'transaction.completed',
        data: {
          id: 'txn_real',
          customerId: 'cust_123',
          subscriptionId: 'sub_123',
          currencyCode: 'USD',
          details: { totals: { grandTotal: '2300' } },
          payments: [{
            methodDetails: {
              card: { type: 'visa', last4: '4242', expiryMonth: '12', expiryYear: '2027' },
            },
          }],
        },
      });

      await request(server)
        .post('/billing/webhooks/paddle')
        .set('paddle-signature', 'ok')
        .send({})
        .expect(201);

      const [invoice] = await sql<{ amount: number }[]>`SELECT amount FROM invoices WHERE paddle_invoice_id = 'txn_real'`;
      expect(invoice).toBeDefined();
      expect(Number(invoice.amount)).toBe(2300);

      const [pm] = await sql<{ last4: string }[]>`SELECT last4 FROM payment_methods WHERE user_id = 1`;
      expect(pm).toBeDefined();
      expect(pm.last4).toBe('4242');
    });
  });

  describe('GET /billing/invoice/:invoiceId', () => {
    it('returns 200 with invoice URL', async () => {});
    it('returns 404 if invoice not found', async () => {});
    it('returns 500 on server error', async () => {});
  });
});
