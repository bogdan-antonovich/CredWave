import { Inject, Injectable } from '@nestjs/common';
import type { Sql } from 'postgres';
import type {
  Subscription,
  PaymentMethod,
  WebhookMetadata,
} from './billing.types';
import { NotFoundException } from '@nestjs/common';
import { Paddle } from '@paddle/paddle-node-sdk';
import {
  EventName,
  EventEntity,
  SubscriptionNotification,
  TransactionNotification,
  SubscriptionCreatedNotification,
} from '@paddle/paddle-node-sdk';
import { UnauthorizedException } from '@nestjs/common';
import { AppConfigService } from '../config/config.service';
import { EmailService } from '../email/email.serivice';
import {
  LogMethods,
  Exclude,
} from 'src/shared/decorators/log-methods.decorator';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@LogMethods()
@Injectable()
export class BillingService {
  protected readonly logger: PinoLogger;

  constructor(
    @Inject('SQL') private readonly sql: Sql,
    @Inject('PADDLE') private readonly paddle: Paddle,
    private readonly cfg: AppConfigService,
    private readonly email: EmailService,
    @InjectPinoLogger(BillingService.name) logger: PinoLogger,
  ) {
    this.logger = logger;
  }

  private async getUserByCustomerId(
    customerId: string,
  ): Promise<{ email: string; name: string } | null> {
    const [user] = await this.sql<{ email: string; name: string }[]>`
      SELECT email, name FROM users WHERE paddle_customer_id = ${customerId}
    `;
    return user ?? null;
  }

  async getSubscription(userId: string): Promise<Subscription | null> {
    const [sub] = await this.sql<
      {
        plan_name: string;
        price: number;
        period: string;
        status: string;
        current_period_end: Date;
        paddle_subscription_id: string;
        reviews_limit: number;
      }[]
    >`
      SELECT * FROM subscriptions WHERE user_id = ${userId}
    `;
    if (!sub) {
      this.logger.debug({ userId }, 'No subscription found');
      return null;
    }

    if (sub.status === 'canceled' && sub.current_period_end < new Date()) {
      this.logger.debug({ userId }, 'Subscription canceled and period expired');
      return null;
    }

    const [pm] = await this.sql<PaymentMethod[]>`
      SELECT brand, last4, expiry FROM payment_methods WHERE user_id = ${userId}
    `;

    const [usage] = await this.sql<{ count: number }[]>`
      SELECT COUNT(*) as count FROM reviews
      WHERE restaurant_id IN (
        SELECT id FROM restaurants WHERE user_id = ${userId}
      )
      AND posted_at > (
        SELECT current_period_end - INTERVAL '1 month' FROM subscriptions WHERE user_id = ${userId}
      )
    `;

    this.logger.debug({ userId }, 'Subscription retrieved successfully');
    return {
      plan: {
        name: sub.plan_name,
        price: sub.price,
        period: sub.period,
        status: sub.status,
        nextBillingDate: sub.current_period_end.toISOString(),
        paddleSubscriptionId: sub.paddle_subscription_id,
      },
      usage: {
        reviewsUsed: Number(usage.count),
        reviewsLimit: sub.reviews_limit,
      },
      paymentMethod: pm ?? null,
    };
  }

  async getInvoices(userId: string) {
    const invoices = await this.sql<
      {
        id: string;
        paddle_invoice_id: string;
        amount: number;
        currency: string;
        status: string;
        download_url: string;
        created_at: Date;
      }[]
    >`
      SELECT id, paddle_invoice_id, amount, currency, status, download_url, created_at
      FROM invoices
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;

    this.logger.debug({ userId }, 'Invoices retrieved successfully');
    return {
      invoices: invoices.map((inv) => ({
        id: inv.id,
        paddle_invoice_id: inv.paddle_invoice_id,
        date: inv.created_at.toISOString(),
        amount: inv.amount,
        currency: inv.currency,
        status: inv.status,
        download_url: inv.download_url,
      })),
    };
  }

  async openPortal(userId: string): Promise<{ url: string }> {
    const [user] = await this.sql<{ paddle_customer_id: string }[]>`
      SELECT paddle_customer_id FROM users WHERE id = ${userId}
    `;
    if (!user?.paddle_customer_id)
      throw new NotFoundException('No billing account found');

    const session = await this.paddle.customerPortalSessions.create(
      user.paddle_customer_id,
      [],
    );

    this.logger.debug(
      { userId },
      'Customer portal session created successfully',
    );
    return { url: session.urls.general.overview };
  }

  private async onSubscriptionCreated(
    @Exclude() data: SubscriptionCreatedNotification,
  ) {
    const metadata = data.customData as WebhookMetadata | undefined;
    const userId = metadata?.userId;

    if (!userId) {
      throw new NotFoundException('No userId found in customData!');
    }

    await this.sql`
        UPDATE users SET paddle_customer_id = ${data.customerId}
        WHERE id = ${userId}
      `;

    const planLimits: Record<string, number> = {
      starter: 50,
      growth: 200,
      enterprise: 1000,
    };

    const price = data.items[0]?.price;
    const planName = price?.name?.toLowerCase() ?? 'starter';

    await this.sql`
      INSERT INTO subscriptions (
        user_id, paddle_subscription_id, plan_name, price,
        period, status, reviews_limit, current_period_end
      )
      SELECT u.id,
        ${data.id},
        ${planName},
        ${Number(price?.unitPrice?.amount ?? 0)},
        ${data.billingCycle.interval},
        ${data.status},
        ${planLimits[planName] ?? 50},
        ${data.currentBillingPeriod?.endsAt ?? null}
      FROM users u WHERE u.paddle_customer_id = ${data.customerId}
    `;

    this.logger.debug(
      { userId: data.customerId },
      'Subscription created successfully',
    );

    await this.sql`
      UPDATE users SET paddle_customer_id = ${data.customerId}
      WHERE paddle_customer_id IS NULL AND id = (
        SELECT id FROM users WHERE paddle_customer_id = ${data.customerId}
      )
    `;

    this.logger.debug(
      { userId: data.customerId },
      'Subscription linked to user successfully',
    );

    const user = await this.getUserByCustomerId(data.customerId);
    if (user) {
      const price = data.items[0]?.price;
      const planName = price?.name ?? 'Starter';
      const nextBillingDate = data.currentBillingPeriod?.endsAt
        ? new Date(data.currentBillingPeriod.endsAt).toLocaleDateString(
            'en-US',
            { month: 'short', day: 'numeric', year: 'numeric' },
          )
        : '—';
      void this.email.sendSubscriptionStarted(
        user.email,
        user.name ?? 'there',
        planName,
        data.billingCycle.interval,
        nextBillingDate,
      );
    }
  }

  private async onSubscriptionUpdated(
    @Exclude() data: SubscriptionNotification,
  ) {
    const planName = data.items[0]?.price?.name?.toLowerCase() ?? 'starter';

    await this.sql`
      UPDATE subscriptions
      SET status = ${data.status},
          plan_name = ${planName},
          current_period_end = ${data.currentBillingPeriod?.endsAt ?? null},
          updated_at = NOW()
      WHERE paddle_subscription_id = ${data.id}
    `;

    this.logger.debug(
      { subscriptionId: data.id },
      'Subscription updated successfully',
    );
  }

  private async onSubscriptionCanceled(
    @Exclude() data: SubscriptionNotification,
  ) {
    await this.sql`
      UPDATE subscriptions
      SET status = 'canceled', updated_at = NOW()
      WHERE paddle_subscription_id = ${data.id}
    `;

    this.logger.debug(
      { subscriptionId: data.id },
      'Subscription canceled successfully',
    );

    const [sub] = await this.sql<
      {
        email: string;
        name: string;
        plan_name: string;
        current_period_end: Date;
      }[]
    >`
      SELECT u.email, u.name, s.plan_name, s.current_period_end
      FROM subscriptions s JOIN users u ON u.id = s.user_id
      WHERE s.paddle_subscription_id = ${data.id}
    `;
    if (sub) {
      const accessUntil = sub.current_period_end.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      void this.email.sendSubscriptionCanceled(
        sub.email,
        sub.name ?? 'there',
        sub.plan_name,
        accessUntil,
      );
    }
  }

  private async onSubscriptionPastDue(
    @Exclude() data: SubscriptionNotification,
  ) {
    await this.sql`
      UPDATE subscriptions
      SET status = 'past_due', updated_at = NOW()
      WHERE paddle_subscription_id = ${data.id}
    `;

    this.logger.debug(
      { subscriptionId: data.id },
      'Subscription past due successfully',
    );

    const [sub] = await this.sql<
      { email: string; name: string; plan_name: string }[]
    >`
      SELECT u.email, u.name, s.plan_name
      FROM subscriptions s JOIN users u ON u.id = s.user_id
      WHERE s.paddle_subscription_id = ${data.id}
    `;
    if (sub) {
      void this.email.sendPaymentFailed(
        sub.email,
        sub.name ?? 'there',
        sub.plan_name,
      );
    }
  }

  private async onTransactionCompleted(
    @Exclude() data: TransactionNotification,
  ) {
    const total = data.details?.totals?.grandTotal ?? '0';
    const card = data.payments[0]?.methodDetails?.card;

    // save payment method if card exists
    if (card && data.customerId) {
      await this.sql`
        INSERT INTO payment_methods (user_id, brand, last4, expiry)
        SELECT u.id,
          ${card.type},
          ${card.last4},
          ${card.expiryMonth + '/' + card.expiryYear}
        FROM users u WHERE u.paddle_customer_id = ${data.customerId}
        ON CONFLICT (user_id) DO UPDATE
        SET brand = EXCLUDED.brand,
            last4 = EXCLUDED.last4,
            expiry = EXCLUDED.expiry,
            updated_at = NOW()
      `;

      this.logger.debug(
        { transactionId: data.id },
        'Payment method saved successfully',
      );
    }

    await this.sql`
      INSERT INTO invoices (user_id, paddle_invoice_id, amount, currency, status, download_url)
      SELECT u.id,
        ${data.id},
        ${Number(total)},
        ${data.currencyCode},
        'paid',
        ${data.invoiceId ?? null}
      FROM users u WHERE u.paddle_customer_id = ${data.customerId}
      ON CONFLICT (paddle_invoice_id) DO NOTHING
    `;

    this.logger.debug({ invoiceId: data.id }, 'Invoice created successfully');

    if (data.customerId && data.subscriptionId) {
      const user = await this.getUserByCustomerId(data.customerId);
      const [sub] = await this.sql<
        { plan_name: string; current_period_end: Date }[]
      >`
        SELECT plan_name, current_period_end FROM subscriptions
        WHERE paddle_subscription_id = ${data.subscriptionId}
      `;

      this.logger.debug({ user, sub }, 'User and sub gotten');

      if (user && sub) {
        const amount = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: data.currencyCode ?? 'USD',
        }).format(Number(total) / 100);
        const nextBillingDate = sub.current_period_end.toLocaleDateString(
          'en-US',
          { month: 'short', day: 'numeric', year: 'numeric' },
        );
        void this.email.sendSubscriptionRenewed(
          user.email,
          user.name ?? 'there',
          sub.plan_name,
          amount,
          nextBillingDate,
        );

        this.logger.debug({ user, sub }, 'Subscription renewed email sent');
      }
    }
  }

  async handleWebhook(
    @Exclude() rawBody: Buffer,
    @Exclude() signature: string,
  ) {
    // verify signature
    const webhookSecret: string = this.cfg.get('paddle').webhookSecret;

    let event: EventEntity;
    try {
      event = await this.paddle.webhooks.unmarshal(
        rawBody.toString(),
        webhookSecret,
        signature,
      );
    } catch {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    switch (event.eventType) {
      case EventName.SubscriptionCreated:
        await this.onSubscriptionCreated(event.data);
        break;
      case EventName.SubscriptionUpdated:
        await this.onSubscriptionUpdated(event.data);
        break;
      case EventName.SubscriptionCanceled:
        await this.onSubscriptionCanceled(event.data);
        break;
      case EventName.SubscriptionPastDue:
        await this.onSubscriptionPastDue(event.data);
        break;
      case EventName.TransactionCompleted:
        await this.onTransactionCompleted(event.data);
        break;
      case EventName.TransactionPaymentFailed:
        break;
    }

    this.logger.debug(
      { eventType: event.eventType },
      'Webhook event handled successfully',
    );

    return { received: true };
  }
}
