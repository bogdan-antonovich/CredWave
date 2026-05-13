import { google } from 'googleapis';
import { Injectable } from '@nestjs/common';
import type { Sql } from 'postgres';
import { Inject } from '@nestjs/common';
import type {
  AutoReplyChanges,
  RestaurantChanges,
  Restaurant,
} from './restaurants.types';
import { AppConfigService } from '../config/config.service';
import { GoogleTokensService } from '../auth/auth.service';
import { LogMethods } from 'src/shared/decorators/log-methods.decorator';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@LogMethods()
@Injectable()
export class RestaurantsService {
  protected readonly logger: PinoLogger;

  constructor(
    @Inject('SQL') private readonly sql: Sql,
    private readonly cfg: AppConfigService,
    private readonly googleTokens: GoogleTokensService,
    @InjectPinoLogger(RestaurantsService.name) logger: PinoLogger,
  ) {
    this.logger = logger;
  }

  async getBusinessLocations(userId: string) {
    return this.googleTokens.withAutoRefresh(userId, async (token) => {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: token });

      const mybusiness = google.mybusinessbusinessinformation({
        version: 'v1',
        auth,
      });
      const accounts = await google
        .mybusinessaccountmanagement({ version: 'v1', auth })
        .accounts.list();

      const accountName = accounts.data.accounts![0].name!;

      const locations = await mybusiness.accounts.locations.list({
        parent: accountName,
      });

      this.logger.debug(
        { accountName },
        'Business locations retrieved successfully',
      );

      return locations.data;
    });
  }

  async getRestaurants(userId: string): Promise<{
    restaurants: Restaurant[];
  }> {
    try {
      const googleData = await this.getBusinessLocations(userId);
      const locations = googleData.locations ?? [];

      const result: Restaurant[] = [];

      this.logger.debug(
        { userId, locations_length: locations.length },
        'Locations retrieved successfully',
      );

      for (const location of locations) {
        const slug = location.title!.toLowerCase().replace(/\s+/g, '-');

        const [row] = await this.sql<Restaurant[]>`
          INSERT INTO restaurants (user_id, google_location_id, name, slug, address)
          VALUES (
            ${userId},
            ${location.name!},
            ${location.title!},
            ${slug},
            ${location.storefrontAddress?.addressLines?.join(', ') ?? null}
          )
          ON CONFLICT (google_location_id) DO UPDATE
          SET name = ${location.title!},
              updated_at = NOW()
          RETURNING
            id,
            name,
            slug,
            address,
            owner_name       AS "ownerName",
            additional_info  AS "additionalInfo",
            updated_at       AS "updatedAt"
        `;
        result.push(row);
      }

      this.logger.debug({ userId }, 'Restaurants retrieved successfully');

      return { restaurants: result };
    } catch (err) {
      this.logger.warn(
        { err: err as Error },
        'Google API unavailable, falling back to DB data',
      );
      const rows = await this.sql<Restaurant[]>`
        SELECT
          id,
          name,
          slug,
          address,
          owner_name      AS "ownerName",
          additional_info AS "additionalInfo",
          updated_at      AS "updatedAt"
        FROM restaurants
        WHERE user_id = ${userId}
      `;
      return { restaurants: rows };
    }
  }

  async updateRestaurantInfo(id: string, userId: string, data: RestaurantChanges) {
    await this.sql`
      UPDATE restaurants
      SET
          name = ${data.name},
          owner_name = ${data.ownerName},
          additional_info = ${data.additionalInfo},
          updated_at = NOW()
      WHERE id = ${id} AND user_id = ${userId}
    `;
    this.logger.debug({ id }, 'Restaurant info updated successfully');
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
    this.logger.debug({ id }, 'Auto reply retrieved successfully');
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
    this.logger.debug({ id }, 'Auto reply updated successfully');
  }

  async searchRestaurants(query: string) {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&type=restaurant&key=${this.cfg.get('google').places.apiKey}`,
    );
    this.logger.debug({ res }, 'Restaurant search response received');
    const data = (await res.json()) as {
      results: {
        name: string;
        formatted_address: string;
        rating: number;
        user_ratings_total: number;
        place_id: string;
      }[];
    };

    this.logger.debug({ data }, 'Restaurant searching done');

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
