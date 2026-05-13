import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common/decorators/core/inject.decorator';
import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common/exceptions';
import type { Sql } from 'postgres';
import {
  ReviewBlock,
  ReviewResponse,
  RestaurantCredentials,
  PromoCodeDto,
} from './admin.types';
import { LogMethods } from 'src/shared/decorators/log-methods.decorator';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@LogMethods()
@Injectable()
export class AdminService {
  protected readonly logger: PinoLogger;

  constructor(
    @Inject('SQL') private readonly sql: Sql,
    @InjectPinoLogger(AdminService.name) logger: PinoLogger,
  ) {
    this.logger = logger;
  }

  async getRestaurants() {
    const rows = await this.sql<{ name: string; slug: string }[]>`
      SELECT name, slug FROM d_restaurants ORDER BY created_at DESC
    `;
    return { restaurants: rows };
  }

  async addRestaurant(body: RestaurantCredentials) {
    const [row] = await this.sql<{ id: number }[]>`
      INSERT INTO d_restaurants (name, slug)
      VALUES (${body.name}, ${body.slug})
      RETURNING id
    `;

    if (!row) {
      throw new InternalServerErrorException('Failed to create restaurant');
    }

    return { id: row.id };
  }

  async deleteRestaurant(slug: string) {
    await this.sql.begin(async (tx) => {
      const [restaurant] = await tx<{ id: number }[]>`
        SELECT id FROM d_restaurants WHERE slug = ${slug}
      `;

      if (!restaurant) {
        throw new NotFoundException('Restaurant not found');
      }

      await tx`
        DELETE FROM d_restaurants WHERE id = ${restaurant.id}
      `;
    });
  }

  async getBlocks(slug: string) {
    const [restaurant] = await this.sql<{ id: number; name: string }[]>`
      SELECT id, name FROM d_restaurants WHERE slug = ${slug}
    `;

    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }

    const reviews = await this.sql<
      {
        id: number;
        reviewer_name: string;
        review_text: string;
        rating: number;
        link: string;
      }[]
    >`
      SELECT id, reviewer_name, review_text, rating, link
      FROM d_reviews
      WHERE restaurant_id = ${restaurant.id}
      ORDER BY created_at DESC
    `;

    const result = await Promise.all(
      reviews.map(async (review) => {
        const responses = await this.sql<ReviewResponse[]>`
          SELECT text, tone
          FROM d_responses
          WHERE review_id = ${review.id}
        `;

        return {
          id: review.id,
          restaurant_name: restaurant.name,
          reviewer_name: review.reviewer_name,
          review_text: review.review_text,
          rating: review.rating,
          link: review.link,
          responses,
        };
      }),
    );

    return { blocks: result };
  }

  async updateBlock(id: number, body: ReviewBlock) {
    await this.sql.begin(async (tx) => {
      await tx`
        UPDATE d_reviews
        SET reviewer_name = ${body.reviewerName},
            review_text = ${body.reviewText},
            rating = ${body.rating}
        WHERE id = ${id}
      `;

      await tx`
        DELETE FROM d_responses
        WHERE review_id = ${id}
      `;

      for (const response of body.responses) {
        await tx`
          INSERT INTO d_responses (review_id, text, tone)
          VALUES (${id}, ${response.text}, ${response.tone})
        `;
      }
    });
  }

  async createBlock(
    slug: string,
    body: Omit<ReviewBlock, 'id' | 'restaurantName'>,
  ) {
    await this.sql.begin(async (tx) => {
      const [restaurant] = await tx<{ id: number }[]>`
        SELECT id FROM d_restaurants WHERE slug = ${slug}
      `;

      if (!restaurant) {
        throw new NotFoundException('Restaurant not found');
      }

      const [review] = await tx<{ id: number }[]>`
        INSERT INTO d_reviews (restaurant_id, reviewer_name, review_text, rating, link)
        VALUES (${restaurant.id}, ${body.reviewerName}, ${body.reviewText}, ${body.rating}, ${body.link})
        RETURNING id
      `;

      for (const response of body.responses) {
        await tx`
          INSERT INTO d_responses (review_id, text, tone)
          VALUES (${review.id}, ${response.text}, ${response.tone})
        `;
      }
    });
  }

  async deleteBlock(id: number) {
    await this.sql`
      DELETE FROM d_reviews WHERE id = ${id}
    `;
  }

  async createPromoCode(promo: PromoCodeDto) {
    await this.sql`
      INSERT INTO promo_codes (code, duration_days, max_uses, expires_at)
      VALUES (
        ${promo.code},
        ${promo.durationDays},
        ${promo.maxUses ?? null},
        ${promo.expiresAt ?? null}
      )
    `;
  }

  async getPromoCodes(): Promise<PromoCodeDto[]> {
    const rows = await this.sql<
      {
        code: string;
        duration_days: number;
        max_uses: number | null;
        use_count: number;
        expires_at: Date | null;
        is_active: boolean;
        created_at: Date;
      }[]
    >`
      SELECT * FROM promo_codes ORDER BY created_at DESC
    `;
    return rows.map((r) => ({
      code: r.code,
      durationDays: r.duration_days,
      maxUses: r.max_uses ?? undefined,
      useCount: r.use_count,
      expiresAt: r.expires_at?.toISOString(),
      isActive: r.is_active,
    }));
  }

  async updatePromoCode(
    code: string,
    data: {
      durationDays: number;
      maxUses?: number;
      expiresAt?: string;
      isActive: boolean;
    },
  ) {
    await this.sql`
      UPDATE promo_codes
      SET duration_days = ${data.durationDays},
          max_uses      = ${data.maxUses ?? null},
          expires_at    = ${data.expiresAt ?? null},
          is_active     = ${data.isActive}
      WHERE code = ${code}
    `;
  }

  async deletePromoCode(code: string) {
    await this.sql.begin(async (tx) => {
      const users = await tx<{ id: number }[]>`
        SELECT id FROM users WHERE promo_code = ${code}
        `;
      for (const user of users) {
        await tx`
          UPDATE users SET promo_code = NULL WHERE id = ${user.id}
        `;
      }
      await tx`
        DELETE FROM promo_codes WHERE code = ${code}
      `;
    });
  }
}
