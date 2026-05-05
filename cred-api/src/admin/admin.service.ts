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
      }[]
    >`
      SELECT id, reviewer_name, review_text, rating
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
        INSERT INTO d_reviews (restaurant_id, reviewer_name, review_text, rating)
        VALUES (${restaurant.id}, ${body.reviewerName}, ${body.reviewText}, ${body.rating})
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
}
