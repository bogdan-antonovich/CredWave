import type { Sql } from 'postgres';
import { Injectable, Inject } from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import OpenAI from 'openai';
import { AppConfigService } from 'src/config/config.service';
import { google } from 'googleapis';
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

  private async getAccessToken(userId: string): Promise<string | null> {
    const [row] = await this.sql<{ token: string }[]>`
      SELECT token
      FROM gl_access_tokens
      WHERE user_id = ${userId}
    `;
    return row?.token ?? null;
  }

  async generateResponses(reviewId: string, additionalContext?: string) {
    const [review] = await this.sql<
      {
        review_text: string;
        rating: number;
        reviewer_name: string;
        restaurant_id: string;
      }[]
    >`
      SELECT review_text, rating, reviewer_name, restaurant_id
      FROM reviews WHERE id = ${reviewId}
    `;
    if (!review) throw new NotFoundException('Review not found');

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

    return { responses, generated_at };
  }

  async replyToReview(reviewId: string, text: string) {
    const [review] = await this.sql<
      {
        google_review_id: string;
        restaurant_id: number;
      }[]
    >`
      SELECT google_review_id, restaurant_id FROM reviews WHERE id = ${reviewId}
    `;
    if (!review) throw new NotFoundException('Review not found');

    const [restaurant] = await this.sql<
      {
        user_id: string;
        google_account_id: string;
        google_location_id: string;
      }[]
    >`
      SELECT user_id, google_account_id, google_location_id
      FROM restaurants WHERE id = ${review.restaurant_id}
    `;

    const accessToken = await this.getAccessToken(restaurant.user_id);
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    await auth.request({
      url: `https://mybusiness.googleapis.com/v4/${restaurant.google_account_id}/${restaurant.google_location_id}/reviews/${review.google_review_id}/reply`,
      method: 'PUT',
      body: JSON.stringify({ comment: text }),
    });

    const replied_at = new Date();

    await this.sql`
      UPDATE reviews
      SET replied = true,
          reply_text = ${text},
          replied_at = ${replied_at}
      WHERE id = ${reviewId}
    `;

    return { success: true, replied_at };
  }
}
