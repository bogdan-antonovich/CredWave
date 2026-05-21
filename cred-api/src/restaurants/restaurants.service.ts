import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import type { Sql } from 'postgres';
import { Inject } from '@nestjs/common';
import type {
  AutoReplyChanges,
  RestaurantChanges,
  Restaurant,
  SwitchRestaurantDto,
} from './restaurants.types';
import { AppConfigService } from '../config/config.service';
import { LogMethods } from 'src/shared/decorators/log-methods.decorator';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@LogMethods()
@Injectable()
export class RestaurantsService {
  protected readonly logger: PinoLogger;

  constructor(
    @Inject('SQL') private readonly sql: Sql,
    private readonly cfg: AppConfigService,
    @InjectPinoLogger(RestaurantsService.name) logger: PinoLogger,
  ) {
    this.logger = logger;
  }

  async getRestaurants(userId: string): Promise<{ restaurants: Restaurant[] }> {
    const rows = await this.sql<Restaurant[]>`
      SELECT
        id,
        name,
        slug,
        address,
        google_place_id      AS "googlePlaceId",
        owner_name           AS "ownerName",
        additional_info      AS "additionalInfo",
        google_rating        AS "googleRating",
        google_review_count  AS "googleReviewCount",
        google_photo_url     AS "googlePhotoUrl",
        google_description      AS "googleDescription",
        restaurant_changed_at   AS "restaurantChangedAt",
        updated_at              AS "updatedAt"
      FROM restaurants
      WHERE user_id = ${userId}
    `;
    this.logger.debug({ userId }, 'Restaurants retrieved from DB');
    return { restaurants: rows };
  }

  async createRestaurant(
    userId: string,
    placeId: string,
    name: string,
    address: string | null,
  ): Promise<Restaurant> {
    const slug = name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    const [row] = await this.sql<Restaurant[]>`
      INSERT INTO restaurants (user_id, google_place_id, name, slug, address)
      VALUES (${userId}, ${placeId}, ${name}, ${slug}, ${address})
      ON CONFLICT (user_id, google_place_id) DO UPDATE
      SET name = ${name}, updated_at = NOW()
      RETURNING
        id,
        name,
        slug,
        address,
        google_place_id      AS "googlePlaceId",
        owner_name           AS "ownerName",
        additional_info      AS "additionalInfo",
        google_rating        AS "googleRating",
        google_review_count  AS "googleReviewCount",
        google_photo_url     AS "googlePhotoUrl",
        google_description   AS "googleDescription",
        updated_at           AS "updatedAt"
    `;

    this.logger.debug({ userId, placeId }, 'Restaurant created/updated');
    return row;
  }

  async updateRestaurantInfo(
    id: string,
    userId: string,
    data: RestaurantChanges,
  ) {
    await this.sql`
      UPDATE restaurants
      SET
          name = ${data.name},
          owner_name = ${data.ownerName},
          additional_info = ${data.additionalInfo},
          updated_at = NOW()
      WHERE id = ${id} AND user_id = ${userId}
    `;
    this.logger.debug({ id }, 'Restaurant info updated');
  }

  async getAutoReply(id: string, userId: string) {
    const [row] = await this.sql<AutoReplyChanges[]>`
      SELECT
          auto_reply_enabled       AS "enabled",
          auto_reply_default_tone  AS "defaultTone",
          auto_reply_custom_instructions AS "customInstructions"
      FROM restaurants
      WHERE id = ${id} AND user_id = ${userId}
    `;
    this.logger.debug({ id }, 'Auto reply retrieved');
    return row ?? null;
  }

  async updateAutoReply(id: string, userId: string, data: AutoReplyChanges) {
    await this.sql`
      UPDATE restaurants
      SET
          auto_reply_enabled = ${data.enabled},
          auto_reply_default_tone = ${data.defaultTone},
          auto_reply_custom_instructions = ${data.customInstructions},
          updated_at = NOW()
      WHERE id = ${id} AND user_id = ${userId}
    `;
    this.logger.debug({ id }, 'Auto reply updated');
  }

  async switchRestaurant(
    id: string,
    userId: string,
    data: SwitchRestaurantDto,
  ): Promise<Restaurant> {
    const [current] = await this.sql<{ restaurant_changed_at: Date | null }[]>`
      SELECT restaurant_changed_at FROM restaurants WHERE id = ${id} AND user_id = ${userId}
    `;

    if (current?.restaurant_changed_at) {
      const msSinceChange =
        Date.now() - new Date(current.restaurant_changed_at).getTime();
      const msInWeek = 7 * 24 * 60 * 60 * 1000;
      if (msSinceChange < msInWeek) {
        const daysLeft = Math.ceil((msInWeek - msSinceChange) / 86_400_000);
        throw new HttpException(
          `You can change your restaurant again in ${daysLeft} day(s).`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const slug = data.name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    await this.sql`DELETE FROM reviews WHERE restaurant_id = ${id}`;

    const [row] = await this.sql<Restaurant[]>`
      UPDATE restaurants
      SET
        google_place_id       = ${data.placeId},
        name                  = ${data.name},
        slug                  = ${slug},
        address               = ${data.address ?? null},
        last_synced_at        = NULL,
        google_rating         = NULL,
        google_review_count   = NULL,
        google_photo_url      = NULL,
        google_description    = NULL,
        restaurant_changed_at = NOW(),
        updated_at            = NOW()
      WHERE id = ${id} AND user_id = ${userId}
      RETURNING
        id,
        name,
        slug,
        address,
        google_place_id         AS "googlePlaceId",
        owner_name              AS "ownerName",
        additional_info         AS "additionalInfo",
        google_rating           AS "googleRating",
        google_review_count     AS "googleReviewCount",
        google_photo_url        AS "googlePhotoUrl",
        google_description      AS "googleDescription",
        restaurant_changed_at   AS "restaurantChangedAt",
        updated_at              AS "updatedAt"
    `;

    this.logger.debug({ id, placeId: data.placeId }, 'Restaurant switched');
    return row;
  }

  async searchRestaurants(query: string) {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&type=restaurant&key=${this.cfg.get('google').places.apiKey}`,
    );
    const data = (await res.json()) as {
      results: {
        name: string;
        formatted_address: string;
        rating: number;
        user_ratings_total: number;
        place_id: string;
      }[];
    };

    this.logger.debug({ query }, 'Restaurant search done');

    return {
      results: data.results.map((place) => ({
        name: place.name,
        slug: place.name.toLowerCase().replace(/\s+/g, '-'),
        location: place.formatted_address,
        rating: place.rating,
        review_count: place.user_ratings_total,
        google_place_id: place.place_id,
      })),
    };
  }
}
