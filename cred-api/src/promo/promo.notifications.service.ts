import { Injectable, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { Sql } from 'postgres';
import { LogMethods } from 'src/shared/decorators/log-methods.decorator';
import { EmailService } from '../email/email.serivice';

interface PromoUser {
  id: number;
  email: string;
  name: string;
  promo_code: string;
  promo_access_until: Date;
}

@LogMethods()
@Injectable()
export class PromoNotificationsService {
  protected readonly logger: PinoLogger;

  constructor(
    @Inject('SQL') private readonly sql: Sql,
    private readonly email: EmailService,
    @InjectPinoLogger(PromoNotificationsService.name) logger: PinoLogger,
  ) {
    this.logger = logger;
  }

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async runNotifications(): Promise<void> {
    this.logger.info('Running promo expiry notifications');
    await Promise.all([
      this.notify7d(),
      this.notify3d(),
      this.notify1d(),
      this.notifyExpired(),
    ]);
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  private async notify7d(): Promise<void> {
    const users = await this.sql<PromoUser[]>`
      SELECT id, email, name, promo_code, promo_access_until
      FROM users
      WHERE promo_access_until IS NOT NULL
        AND promo_access_until > NOW()
        AND promo_access_until <= NOW() + INTERVAL '7 days'
        AND promo_notif_7d = FALSE
    `;
    for (const user of users) {
      void this.email.sendPromoExpiringSoon(
        user.email,
        user.name ?? 'there',
        user.promo_code,
        7,
        this.formatDate(user.promo_access_until),
      );
      await this.sql`
        UPDATE users SET promo_notif_7d = TRUE WHERE id = ${user.id}
      `;
    }
    this.logger.debug({ count: users.length }, 'Sent 7d promo expiry notices');
  }

  private async notify3d(): Promise<void> {
    const users = await this.sql<PromoUser[]>`
      SELECT id, email, name, promo_code, promo_access_until
      FROM users
      WHERE promo_access_until IS NOT NULL
        AND promo_access_until > NOW()
        AND promo_access_until <= NOW() + INTERVAL '3 days'
        AND promo_notif_3d = FALSE
    `;
    for (const user of users) {
      void this.email.sendPromoExpiringSoon(
        user.email,
        user.name ?? 'there',
        user.promo_code,
        3,
        this.formatDate(user.promo_access_until),
      );
      await this.sql`
        UPDATE users SET promo_notif_3d = TRUE WHERE id = ${user.id}
      `;
    }
    this.logger.debug({ count: users.length }, 'Sent 3d promo expiry notices');
  }

  private async notify1d(): Promise<void> {
    const users = await this.sql<PromoUser[]>`
      SELECT id, email, name, promo_code, promo_access_until
      FROM users
      WHERE promo_access_until IS NOT NULL
        AND promo_access_until > NOW()
        AND promo_access_until <= NOW() + INTERVAL '1 day'
        AND promo_notif_1d = FALSE
    `;
    for (const user of users) {
      void this.email.sendPromoExpiringSoon(
        user.email,
        user.name ?? 'there',
        user.promo_code,
        1,
        this.formatDate(user.promo_access_until),
      );
      await this.sql`
        UPDATE users SET promo_notif_1d = TRUE WHERE id = ${user.id}
      `;
    }
    this.logger.debug({ count: users.length }, 'Sent 1d promo expiry notices');
  }

  private async notifyExpired(): Promise<void> {
    const users = await this.sql<PromoUser[]>`
      SELECT id, email, name, promo_code, promo_access_until
      FROM users
      WHERE promo_access_until IS NOT NULL
        AND promo_access_until <= NOW()
        AND promo_notif_expired = FALSE
    `;
    for (const user of users) {
      void this.email.sendPromoExpired(
        user.email,
        user.name ?? 'there',
        user.promo_code,
      );
      await this.sql`
        UPDATE users SET promo_notif_expired = TRUE WHERE id = ${user.id}
      `;
    }
    this.logger.debug({ count: users.length }, 'Sent promo expired notices');
  }
}
