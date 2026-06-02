import type { Sql } from 'postgres';
import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import { AiService } from 'src/shared/ai.service';
import { LogMethods } from 'src/shared/decorators/log-methods.decorator';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@LogMethods()
@Injectable()
export class ReviewsService {
  protected readonly logger: PinoLogger;

  constructor(
    @Inject('SQL') private readonly sql: Sql,
    private readonly aiService: AiService,
    @InjectPinoLogger(ReviewsService.name) logger: PinoLogger,
  ) {
    this.logger = logger;
  }

  async generateResponses(
    reviewId: string,
    userId: string,
    additionalContext?: string,
  ) {
    const [review] = await this.sql<
      {
        review_text: string;
        rating: number;
        reviewer_name: string;
        restaurant_id: string;
      }[]
    >`
      SELECT r.review_text, r.rating, r.reviewer_name, r.restaurant_id
      FROM reviews r
      JOIN restaurants res ON res.id = r.restaurant_id AND res.user_id = ${userId}
      WHERE r.id = ${reviewId}
    `;
    if (!review) throw new NotFoundException('Review not found');

    const [sub] = await this.sql<
      { reviews_limit: number; current_period_end: Date; period: string }[]
    >`
      SELECT reviews_limit, current_period_end, period
      FROM subscriptions WHERE user_id = ${userId} LIMIT 1
    `;

    if (sub) {
      const interval =
        sub.period === 'year' ? "INTERVAL '1 year'" : "INTERVAL '1 month'";
      const [usage] = await this.sql<{ count: string }[]>`
        SELECT COUNT(*) AS count
        FROM responses res
        JOIN reviews r   ON r.id   = res.review_id
        JOIN restaurants rest ON rest.id = r.restaurant_id
        WHERE rest.user_id = ${userId}
          AND res.responses_generated_at > ${sub.current_period_end}::timestamptz
            - ${this.sql.unsafe(interval)}
      `;
      if (Number(usage.count) >= sub.reviews_limit) {
        throw new HttpException(
          'Monthly generation limit reached. Please upgrade your plan.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const [restaurant] = await this.sql<
      { name: string; additional_info: string | null }[]
    >`
      SELECT name, additional_info FROM restaurants WHERE id = ${review.restaurant_id}
    `;

    const responses = await this.aiService.generateReviewResponses(
      restaurant.name,
      review.reviewer_name,
      review.rating,
      review.review_text,
      restaurant.additional_info,
      additionalContext,
    );

    const generated_at = new Date();

    await this.sql`
      INSERT INTO responses (review_id, response_json, responses_generated_at)
      VALUES (${reviewId}, ${this.sql.json(responses)}, ${generated_at})
      ON CONFLICT (review_id)
      DO UPDATE SET response_json = EXCLUDED.response_json,
          responses_generated_at = EXCLUDED.responses_generated_at
    `;

    this.logger.debug({ reviewId }, 'Responses saved');
    return { responses, generated_at };
  }

  async replyToReview(reviewId: string, userId: string, text: string) {
    const [review] = await this.sql<{ id: string }[]>`
      SELECT r.id
      FROM reviews r
      JOIN restaurants res ON res.id = r.restaurant_id AND res.user_id = ${userId}
      WHERE r.id = ${reviewId}
    `;
    if (!review) throw new NotFoundException('Review not found');

    const replied_at = new Date();

    await this.sql`
      UPDATE reviews
      SET replied = true,
          reply_text = ${text},
          replied_at = ${replied_at}
      WHERE id = ${reviewId}
    `;

    this.logger.debug({ reviewId }, 'Review marked as handled');
    return { success: true, replied_at };
  }
}
