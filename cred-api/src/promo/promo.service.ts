import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { Sql } from 'postgres';
import { LogMethods } from 'src/shared/decorators/log-methods.decorator';

@LogMethods()
@Injectable()
export class PromoService {
  protected readonly logger: PinoLogger;

  constructor(
    @Inject('SQL') private readonly sql: Sql,
    @InjectPinoLogger(PromoService.name) logger: PinoLogger,
  ) {
    this.logger = logger;
  }

  async getPromoAccess(
    userId: number,
  ): Promise<{ code: string; accessUntil: string } | null> {
    const [row] = await this.sql<
      { promo_code: string; promo_access_until: Date }[]
    >`
      SELECT promo_code, promo_access_until
      FROM users
      WHERE id = ${userId} AND promo_access_until > NOW()
    `;
    if (!row) return null;
    return {
      code: row.promo_code,
      accessUntil: row.promo_access_until.toISOString(),
    };
  }

  async redeemPromoCode(code: string, userId: number): Promise<void> {
    await this.sql.begin(async (tx) => {
      // Lock the row and validate all conditions atomically to prevent race conditions
      const [promo] = await tx<{ duration_days: number }[]>`
        SELECT duration_days FROM promo_codes
        WHERE code = ${code}
          AND is_active = TRUE
          AND (expires_at IS NULL OR expires_at > NOW())
          AND (max_uses IS NULL OR use_count < max_uses)
        FOR UPDATE
      `;

      if (!promo)
        throw new BadRequestException('Invalid or expired promo code');

      const [user] = await tx<{ promo_code: string | null }[]>`
        SELECT promo_code FROM users WHERE id = ${userId}
      `;

      if (user?.promo_code)
        throw new BadRequestException('Promo code already redeemed');

      await tx`
        UPDATE users
        SET promo_access_until = NOW() + (${promo.duration_days} || ' days')::INTERVAL,
            promo_code = ${code}
        WHERE id = ${userId}
      `;

      await tx`
        UPDATE promo_codes
        SET use_count = use_count + 1
        WHERE code = ${code}
      `;

      this.logger.debug({ userId, code }, 'Promo code redeemed');
    });
  }
}
