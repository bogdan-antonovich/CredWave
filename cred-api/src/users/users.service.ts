import { Injectable, Inject } from '@nestjs/common';
import type { Sql } from 'postgres';
import type { Paddle } from '@paddle/paddle-node-sdk';
import type { User } from '../shared/types';
import { LogMethods } from 'src/shared/decorators/log-methods.decorator';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@LogMethods()
@Injectable()
export class UsersService {
  protected readonly logger: PinoLogger;

  constructor(
    @Inject('SQL') private readonly sql: Sql,
    @Inject('PADDLE') private readonly paddle: Paddle,
    @InjectPinoLogger(UsersService.name) logger: PinoLogger,
  ) {
    this.logger = logger;
  }

  async getUserbyId(userId: string) {
    this.logger.info({ userId }, 'getUserbyId called');
    const [row] = await this.sql<User[]>`
    SELECT id, email, name, picture_url, created_at
    FROM users
    WHERE id = ${userId}
  `;
    this.logger.debug({ userId, found: !!row }, 'getUserbyId result');
    return row ?? null;
  }

  async getGoogleAccessTokenByUserId(userId: string): Promise<string | null> {
    const [row] = await this.sql<{ token: string }[]>`
      SELECT token
      FROM gl_access_tokens
      WHERE user_id = ${userId}
    `;
    return row?.token ?? null;
  }

  async disconnectGoogle(userId: string): Promise<void> {
    const token = await this.getGoogleAccessTokenByUserId(userId);
    if (token) {
      try {
        await fetch(
          `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,
          { method: 'POST' },
        );
      } catch (err) {
        this.logger.warn(
          { err: err as Error },
          'Failed to revoke Google token, proceeding',
        );
      }
    }

    await this.sql.begin(async (tx) => {
      await tx`DELETE FROM gl_access_tokens WHERE user_id = ${userId}`;
      await tx`DELETE FROM gl_refresh_tokens WHERE user_id = ${userId}`;
    });
  }

  async deleteAccount(userId: string): Promise<void> {
    const [sub] = await this.sql<{ paddle_subscription_id: string }[]>`
      SELECT paddle_subscription_id FROM subscriptions
      WHERE user_id = ${userId} AND status NOT IN ('canceled', 'expired')
    `;

    if (sub?.paddle_subscription_id) {
      try {
        await this.paddle.subscriptions.cancel(sub.paddle_subscription_id, {
          effectiveFrom: 'immediately',
        });
      } catch (err) {
        this.logger.warn(
          { err: err as Error },
          'Failed to cancel Paddle subscription',
        );
      }
    }

    await this.sql.begin(async (tx) => {
      await tx`
        DELETE FROM responses WHERE review_id IN (
          SELECT rv.id FROM reviews rv
          JOIN restaurants res ON res.id = rv.restaurant_id
          WHERE res.user_id = ${userId}
        )
      `;
      await tx`
        DELETE FROM reviews WHERE restaurant_id IN (
          SELECT id FROM restaurants WHERE user_id = ${userId}
        )
      `;
      await tx`DELETE FROM restaurants WHERE user_id = ${userId}`;
      await tx`DELETE FROM auth_tokens WHERE user_id = ${userId}`;
      await tx`DELETE FROM blacklisted_tokens WHERE user_id = ${userId}`;
      await tx`DELETE FROM gl_access_tokens WHERE user_id = ${userId}`;
      await tx`DELETE FROM gl_refresh_tokens WHERE user_id = ${userId}`;
      await tx`DELETE FROM subscriptions WHERE user_id = ${userId}`;
      await tx`DELETE FROM payment_methods WHERE user_id = ${userId}`;
      await tx`DELETE FROM invoices WHERE user_id = ${userId}`;
      await tx`DELETE FROM users WHERE id = ${userId}`;
    });
  }
}
