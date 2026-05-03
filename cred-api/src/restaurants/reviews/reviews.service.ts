import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { AppConfigService } from 'src/config/config.service';
import type { Sql } from 'postgres';
import { NotFoundException } from '@nestjs/common';
import {
  Review,
  GoogleReview,
  SerpReview,
  SerpApiReviewsResponse,
} from './reviews.types';
import { google } from 'googleapis';
import { getJson } from 'serpapi';
import { LogMethods } from 'src/shared/decorators/log-methods.decorator';

@LogMethods()
@Injectable()
export class ReviewsService {
  constructor(
    @Inject('SQL') private readonly sql: Sql,
    private readonly cfg: AppConfigService,
  ) {}

  private async getAccessToken(userId: string): Promise<string | null> {
    const [row] = await this.sql<{ token: string }[]>`
      SELECT token
      FROM gl_access_tokens
      WHERE user_id = ${userId}
    `;
    return row?.token ?? null;
  }

  async syncReviews(
    restaurantId: string,
  ): Promise<{ new_reviews: number; synced_at: Date }> {
    const [restaurant] = await this.sql<
      {
        user_id: string;
        google_account_id: string;
        google_location_id: string;
      }[]
    >`
      SELECT user_id, google_account_id, google_location_id
      FROM restaurants WHERE id = ${restaurantId}
    `;
    if (!restaurant) throw new NotFoundException('Restaurant not found');

    const auth = new google.auth.OAuth2();
    auth.setCredentials({
      access_token: await this.getAccessToken(restaurant.user_id),
    });

    const res = await auth.request<{ reviews?: GoogleReview[] }>({
      url: `https://mybusiness.googleapis.com/v4/${restaurant.google_account_id}/${restaurant.google_location_id}/reviews`,
    });

    const reviews = res.data.reviews ?? [];
    let newReviews = 0;

    for (const review of reviews) {
      const [row] = await this.sql<{ inserted: boolean }[]>`
        INSERT INTO reviews (
          restaurant_id, google_review_id, reviewer_name,
          reviewer_avatar_url, review_text, rating, posted_at,
          replied, reply_text, replied_at
        )
        VALUES (
          ${restaurantId},
          ${review.reviewId},
          ${review.reviewer?.displayName ?? null},
          ${review.reviewer?.profilePhotoUrl ?? null},
          ${review.comment ?? null},
          ${ratingToNumber(review.starRating)},
          ${review.createTime},
          ${!!review.reviewReply},
          ${review.reviewReply?.comment ?? null},
          ${review.reviewReply?.updateTime ?? null}
        )
        ON CONFLICT (google_review_id) DO UPDATE SET
          replied = ${!!review.reviewReply},
          reply_text = ${review.reviewReply?.comment ?? null},
          replied_at = ${review.reviewReply?.updateTime ?? null}
        RETURNING (xmax = 0) AS inserted
      `;
      if (row.inserted) newReviews++;
    }

    const synced_at = new Date();
    await this
      .sql`UPDATE restaurants SET last_synced_at = ${synced_at} WHERE id = ${restaurantId}`;

    return { new_reviews: newReviews, synced_at };
  }

  async getReviews(
    restaurantId: string,
    status: string,
    page: number,
    perPage: number,
  ) {
    const [restaurant] = await this.sql<{ is_stale: boolean }[]>`
      SELECT
        last_synced_at IS NULL
        OR (NOW() - last_synced_at) > INTERVAL '5 minutes' AS is_stale
      FROM restaurants WHERE id = ${restaurantId}
    `;
    if (!restaurant) throw new NotFoundException('Restaurant not found');

    if (restaurant.is_stale) await this.syncReviews(restaurantId);

    const offset = (page - 1) * perPage;
    const statusFilter =
      status === 'pending'
        ? this.sql`AND replied = false`
        : status === 'replied'
          ? this.sql`AND replied = true`
          : this.sql``;

    const [reviews, [stats]] = await Promise.all([
      this.sql<Review[]>`
        SELECT * FROM reviews
        WHERE restaurant_id = ${restaurantId}
        ${statusFilter}
        ORDER BY posted_at DESC
        LIMIT ${perPage} OFFSET ${offset}
      `,
      this.sql<{ pending: number; replied: number; total: number }[]>`
        SELECT
          COUNT(*) FILTER (WHERE replied = false) AS pending,
          COUNT(*) FILTER (WHERE replied = true) AS replied,
          COUNT(*) AS total
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

  async getDemoReviewsFromDb(placeId: string): Promise<SerpReview[] | null> {
    const [row] = await this.sql<{ reviews: SerpReview[] }[]>`
      SELECT reviews FROM auto_demo_reviews WHERE place_id = ${placeId}
    `;
    return row?.reviews ?? null;
  }

  async saveDemoReviews(placeId: string, reviews: SerpReview[]) {
    await this.sql`
      INSERT INTO auto_demo_reviews (place_id, reviews, created_at)
      VALUES (${placeId}, ${this.sql.json(reviews as unknown as Parameters<Sql['json']>[0])}, NOW())
      ON CONFLICT (place_id) DO UPDATE
      SET reviews = ${this.sql.json(reviews as unknown as Parameters<Sql['json']>[0])}, created_at = NOW()
    `;
  }

  async getDemoReviews(placeId: string): Promise<{ reviews: SerpReview[] }> {
    const cached = await this.getDemoReviewsFromDb(placeId);
    if (cached) return { reviews: cached };

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

function ratingToNumber(rating: string): number {
  const map: Record<string, number> = {
    ONE: 1,
    TWO: 2,
    THREE: 3,
    FOUR: 4,
    FIVE: 5,
  };
  return map[rating] ?? 0;
}
