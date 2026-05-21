import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { AppConfigService } from 'src/config/config.service';
import type { Sql } from 'postgres';
import { NotFoundException } from '@nestjs/common';
import {
  Review,
  SerpReview,
  SerpApiReviewsResponse,
  DemoBlock,
} from './reviews.types';
import { getJson } from 'serpapi';
import OpenAI from 'openai';
import { EmailService } from '../../email/email.serivice';
import { LogMethods } from 'src/shared/decorators/log-methods.decorator';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

export interface OutscraperReview {
  review_id: string;
  author_title: string | null;
  author_image: string | null;
  review_text: string | null;
  review_rating: number;
  review_datetime_utc: string;
  review_link: string | null;
  review_pagination_id: string | null;
}

interface OutscraperPlace {
  reviews_data?: OutscraperReview[];
}

export interface OutscraperClient {
  googleMapsReviews(
    query: string[],
    reviewsLimit: number,
    reviewsQuery: null,
    limit: number,
    sort: string,
    lastPaginationId: string | null,
    start: null,
    cutoff: string | null,
    cutoffRating: null,
    ignoreEmpty: boolean,
  ): Promise<OutscraperPlace[]>;
}

@LogMethods()
@Injectable()
export class ReviewsService {
  protected readonly logger: PinoLogger;

  constructor(
    @Inject('SQL') private readonly sql: Sql,
    @Inject('OPENAI') private readonly openai: OpenAI,
    private readonly cfg: AppConfigService,
    private readonly email: EmailService,
    @Inject('OUTSCRAPER_CLIENT')
    private readonly outscraperClient: OutscraperClient,
    @InjectPinoLogger(ReviewsService.name) logger: PinoLogger,
  ) {
    this.logger = logger;
  }

  private async fetchFromOutscraper(
    placeId: string,
    limit: number,
    options?: { lastPaginationId?: string; cutoff?: number },
  ): Promise<OutscraperReview[]> {
    const data = await this.outscraperClient.googleMapsReviews(
      [`r${placeId}`],
      limit,
      null,
      1,
      'newest',
      options?.lastPaginationId ?? null,
      null,
      options?.cutoff != null ? String(options.cutoff) : null,
      null,
      true,
    );
    return data[0]?.reviews_data ?? [];
  }

  async syncReviews(
    restaurantId: string,
  ): Promise<{ new_reviews: number; synced_at: Date }> {
    const [restaurant] = await this.sql<
      {
        user_id: string;
        google_place_id: string;
        name: string;
        last_synced_at: Date | null;
      }[]
    >`
      SELECT user_id, google_place_id, name, last_synced_at
      FROM restaurants WHERE id = ${restaurantId}
    `;
    if (!restaurant) throw new NotFoundException('Restaurant not found');

    const isInitialSync = restaurant.last_synced_at == null;

    const cutoff = restaurant.last_synced_at
      ? Math.floor(restaurant.last_synced_at.getTime() / 1000)
      : undefined;

    this.logger.debug(
      { restaurantId, cutoff },
      'Syncing reviews via Outscraper',
    );

    const reviews = await this.fetchFromOutscraper(
      restaurant.google_place_id,
      5,
      { cutoff },
    );

    let newReviews = 0;

    for (const review of reviews) {
      const [row] = await this.sql<{ inserted: boolean }[]>`
        INSERT INTO reviews (
          restaurant_id, google_review_id, reviewer_name,
          reviewer_avatar_url, review_text, rating, posted_at,
          replied, link, outscraper_pagination_id
        )
        VALUES (
          ${restaurantId},
          ${review.review_id},
          ${review.author_title ?? null},
          ${review.author_image ?? null},
          ${review.review_text ?? null},
          ${review.review_rating},
          ${parseOutscraperDate(review.review_datetime_utc)},
          false,
          ${review.review_link ?? null},
          ${review.review_pagination_id ?? null}
        )
        ON CONFLICT (google_review_id) DO NOTHING
        RETURNING (xmax = 0) AS inserted
      `;

      if (row?.inserted) {
        newReviews++;
        if (!isInitialSync) {
          const [user] = await this.sql<{ email: string; name: string }[]>`
            SELECT email, name FROM users WHERE id = ${restaurant.user_id}
          `;
          if (user) {
            void this.email.sendNewReview(
              user.email,
              user.name ?? 'there',
              restaurant.name,
              review.author_title ?? 'Anonymous',
              review.review_rating,
              review.review_text ?? null,
            );
          }
        }
      }
    }

    const synced_at = new Date();
    await this
      .sql`UPDATE restaurants SET last_synced_at = ${synced_at} WHERE id = ${restaurantId}`;

    this.logger.debug({ restaurantId, newReviews, synced_at }, 'Sync complete');
    return { new_reviews: newReviews, synced_at };
  }

  async getReviews(
    restaurantId: string,
    status: string,
    page: number,
    perPage: number,
  ) {
    const [restaurant] = await this.sql<
      { is_stale: boolean; google_place_id: string }[]
    >`
      SELECT
        last_synced_at IS NULL
        OR (NOW() - last_synced_at) > INTERVAL '1 hour' AS is_stale,
        google_place_id
      FROM restaurants WHERE id = ${restaurantId}
    `;
    if (!restaurant) throw new NotFoundException('Restaurant not found');

    if (restaurant.is_stale) await this.syncReviews(restaurantId);

    const offset = (page - 1) * perPage;

    const [countRow] = await this.sql<{ count: string }[]>`
      SELECT COUNT(*) AS count FROM reviews WHERE restaurant_id = ${restaurantId}
    `;
    const dbCount = Number(countRow.count);

    if (offset + perPage > dbCount) {
      const [lastReview] = await this.sql<
        { outscraper_pagination_id: string | null }[]
      >`
        SELECT outscraper_pagination_id FROM reviews
        WHERE restaurant_id = ${restaurantId}
        ORDER BY posted_at ASC LIMIT 1
      `;

      if (lastReview?.outscraper_pagination_id) {
        const moreReviews = await this.fetchFromOutscraper(
          restaurant.google_place_id,
          perPage,
          { lastPaginationId: lastReview.outscraper_pagination_id },
        );

        for (const review of moreReviews) {
          await this.sql`
            INSERT INTO reviews (
              restaurant_id, google_review_id, reviewer_name,
              reviewer_avatar_url, review_text, rating, posted_at,
              replied, link, outscraper_pagination_id
            )
            VALUES (
              ${restaurantId},
              ${review.review_id},
              ${review.author_title ?? null},
              ${review.author_image ?? null},
              ${review.review_text ?? null},
              ${review.review_rating},
              ${parseOutscraperDate(review.review_datetime_utc)},
              false,
              ${review.review_link ?? null},
              ${review.review_pagination_id ?? null}
            )
            ON CONFLICT (google_review_id) DO NOTHING
          `;
        }
      }
    }

    const statusFilter =
      status === 'pending'
        ? this.sql`AND r.replied = false`
        : status === 'replied'
          ? this.sql`AND r.replied = true`
          : this.sql``;

    const [reviews, [stats]] = await Promise.all([
      this.sql<Review[]>`
        SELECT
          r.id,
          r.reviewer_name        AS "reviewerName",
          r.reviewer_avatar_url  AS "reviewerAvatarUrl",
          r.review_text          AS "reviewText",
          r.rating,
          r.posted_at            AS "postedAt",
          r.replied,
          r.reply_text           AS "replyText",
          r.replied_at           AS "repliedAt",
          r.link,
          res.response_json      AS responses,
          res.responses_generated_at AS "responsesGeneratedAt"
        FROM reviews r
        LEFT JOIN responses res ON res.review_id = r.id
        WHERE r.restaurant_id = ${restaurantId}
        ${statusFilter}
        ORDER BY r.posted_at DESC
        LIMIT ${perPage} OFFSET ${offset}
      `,
      this.sql<{ pending: number; replied: number; total: number }[]>`
        SELECT
          COUNT(*) FILTER (WHERE replied = false) AS pending,
          COUNT(*) FILTER (WHERE replied = true)  AS replied,
          COUNT(*)                                 AS total
        FROM reviews
        WHERE restaurant_id = ${restaurantId}
      `,
    ]);

    const filteredTotal =
      status === 'pending'
        ? Number(stats.pending)
        : status === 'replied'
          ? Number(stats.replied)
          : Number(stats.total);

    return {
      reviews,
      pagination: {
        page,
        per_page: perPage,
        total: filteredTotal,
        total_pages: Math.ceil(filteredTotal / perPage),
      },
      stats: {
        pending: Number(stats.pending),
        replied: Number(stats.replied),
        total: Number(stats.total),
      },
    };
  }

  async getDemoReviewsFromDb(
    placeId: string,
  ): Promise<{ reviews: SerpReview[]; blocks: DemoBlock[] | null } | null> {
    const [row] = await this.sql<
      { reviews: SerpReview[]; blocks: DemoBlock[] | null }[]
    >`
      SELECT reviews, blocks FROM auto_demo_reviews WHERE place_id = ${placeId}
    `;
    return row ?? null;
  }

  async saveDemoReviews(placeId: string, reviews: SerpReview[]) {
    await this.sql`
      INSERT INTO auto_demo_reviews (place_id, reviews, created_at)
      VALUES (${placeId}, ${this.sql.json(reviews as unknown as Parameters<Sql['json']>[0])}, NOW())
      ON CONFLICT (place_id) DO UPDATE
      SET reviews = ${this.sql.json(reviews as unknown as Parameters<Sql['json']>[0])}, created_at = NOW()
    `;
  }

  async saveDemoBlocks(placeId: string, blocks: DemoBlock[]) {
    await this.sql`
      UPDATE auto_demo_reviews
      SET blocks = ${this.sql.json(blocks as unknown as Parameters<Sql['json']>[0])}
      WHERE place_id = ${placeId}
    `;
  }

  async generateDemoBlocks(
    placeId: string,
    restaurantName: string,
  ): Promise<{ blocks: DemoBlock[] }> {
    const cached = await this.getDemoReviewsFromDb(placeId);

    if (cached?.blocks) {
      this.logger.debug({ placeId }, 'Returning cached demo blocks');
      return { blocks: cached.blocks };
    }

    const { reviews } = await this.getDemoReviews(placeId);

    const blocks = await Promise.all(
      reviews.map(async (review): Promise<DemoBlock> => {
        const prompt = `
          You are an employee of a restaurant named "${restaurantName}".
          Generate 3 different responses to the following Google review.
          Reviewer: ${review.user.name};
          Rating: ${review.rating}/5;
          Review: ${review.snippet};

          Return ONLY a valid JSON object (no markdown, no extra text):
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

        const responses = JSON.parse(
          completion.choices[0].message.content!,
        ) as { empathetic: string; professional: string; casual: string };

        return {
          reviewer_name: review.user.name,
          review_text: review.snippet,
          rating: review.rating,
          link: review.link,
          ...responses,
        };
      }),
    );

    await this.saveDemoBlocks(placeId, blocks);
    return { blocks };
  }

  async getDemoReviews(placeId: string): Promise<{ reviews: SerpReview[] }> {
    const cached = await this.getDemoReviewsFromDb(placeId);
    if (cached) return { reviews: cached.reviews };

    this.logger.debug('Fetching demo reviews from SerpApi');

    const data = (await getJson({
      engine: 'google_maps_reviews',
      api_key: this.cfg.get('serpapi').apiKey,
      place_id: placeId,
      sort: 'qualityScore',
    })) as SerpApiReviewsResponse;

    const unanswered = (data.reviews ?? []).filter((r) => !r.response);
    const bad = unanswered.filter((r) => r.rating <= 2).slice(0, 2);
    const others = unanswered.filter((r) => r.rating > 2).slice(0, 3);
    const reviews = [...bad, ...others];

    await this.saveDemoReviews(placeId, reviews);
    return { reviews };
  }
}

export function parseOutscraperDate(utcStr: string): Date {
  if (/^\d{4}-\d{2}-\d{2}/.test(utcStr)) {
    return new Date(utcStr.replace(' ', 'T') + 'Z');
  }
  return new Date(utcStr + ' UTC');
}
