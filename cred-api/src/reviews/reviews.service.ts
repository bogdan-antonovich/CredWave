import type { Sql } from 'postgres';
import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import OpenAI from 'openai';
import { AppConfigService } from 'src/config/config.service';
import { LogMethods } from 'src/shared/decorators/log-methods.decorator';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@LogMethods()
@Injectable()
export class ReviewsService {
  protected readonly logger: PinoLogger;

  constructor(
    @Inject('SQL') private readonly sql: Sql,
    @Inject('OPENAI') private readonly openai: OpenAI,
    private readonly cfg: AppConfigService,
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

    // Enforce per-billing-period generation limit
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

    const prompt = `
      You are an employee of a restaurant ${restaurant.name};
      Your job is to create 3 different responses to a review you are going to be given;
      ${restaurant.additional_info ? `About restaurant: ${restaurant.additional_info};` : ''}
      Reviewer: ${review.reviewer_name};
      Rating: ${review.rating}/5;
      Review: ${review.review_text};
      ${additionalContext ? `Additional context: ${additionalContext};` : ''}

      Return only a JSON object, no markdown:
      {
        "empathetic": "...",
        "professional": "...",
        "casual": "..."
      }
    `;

    const completion = await this.openai.chat.completions.create({
      model: this.cfg.get('openai').model,
      messages: [{ role: 'developer', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const responses = JSON.parse(completion.choices[0].message.content!) as {
      empathetic: string;
      professional: string;
      casual: string;
    };

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
