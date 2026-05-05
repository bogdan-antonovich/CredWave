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

  private async getAccessToken(userId: string): Promise<string | null> {
    const [row] = await this.sql<{ token: string }[]>`
      SELECT token
      FROM gl_access_tokens
      WHERE user_id = ${userId}
    `;
    return row?.token ?? null;
  }

  async getBusinessLocations(userId: string) {
    const auth = new google.auth.OAuth2();

    const accessToken = await this.getAccessToken(userId);
    if (!accessToken) {
      throw new Error('Access token not found');
    }

    this.logger.debug({ userId }, 'Access token retrieved successfully');

    auth.setCredentials({ access_token: accessToken });

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
  }

  async getRestaurants(userId: string): Promise<{
    restaurants: Restaurant[];
  }> {
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
  }

  async updateRestaurantInfo(id: string, data: RestaurantChanges) {
    await this.sql`
      UPDATE restaurants
      SET
          name = ${data.name},
          owner_name = ${data.ownerName},
          additional_info = ${data.additionalInfo},
          updated_at = NOW()
      WHERE id = ${id}
    `;
    this.logger.debug({ id }, 'Restaurant info updated successfully');
  }

  async getAutoReply(id: string) {
    const [row] = await this.sql<AutoReplyChanges[]>`
      SELECT
          auto_reply_enabled       AS "enabled",
          auto_reply_default_tone  AS "defaultTone",
          auto_reply_custom_instructions AS "customInstructions"
      FROM restaurants
      WHERE id = ${id}
    `;
    this.logger.debug({ id }, 'Auto reply retrieved successfully');
    return row ?? null;
  }

  async updateAutoReply(id: string, data: AutoReplyChanges) {
    await this.sql`
      UPDATE restaurants
      SET
          auto_reply_enabled = ${data.enabled},
          auto_reply_default_tone = ${data.defaultTone},
          auto_reply_custom_instructions = ${data.customInstructions},
          updated_at = NOW()
      WHERE id = ${id}
    `;
    this.logger.debug({ id }, 'Auto reply updated successfully');
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
