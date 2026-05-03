import { Injectable, Inject } from '@nestjs/common';
import type { Sql } from 'postgres';
import type { User } from '../shared/types';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import { google } from 'googleapis';
import { AppConfigService } from '../config/config.service';
import { LogMethods } from 'src/shared/decorators/log-methods.decorator';

@LogMethods()
@Injectable()
export class AppTokensService {
  constructor(
    @Inject('SQL') private readonly sql: Sql,
    private jwt: JwtService,
  ) {}

  async addToBlacklist(token: string, expiresAt: Date) {
    await this.sql`
      INSERT INTO blacklisted_tokens (token, expires_at)
      VALUES (${token}, ${expiresAt})
    `;
  }

  async isBlacklisted(token: string): Promise<boolean> {
    const result = await this.sql`
      SELECT 1 FROM blacklisted_tokens WHERE token = ${token}
    `;
    return result.length > 0;
  }

  async saveRefreshToken(userId: string, refreshToken: string) {
    await this.sql`
      INSERT INTO auth_tokens (user_id, refresh_token)
      VALUES (${userId}, ${refreshToken})
      ON CONFLICT (user_id) DO UPDATE SET refresh_token = ${refreshToken}
    `;
  }

  async getUserIdByRefreshToken(refreshToken: string): Promise<string | null> {
    const [row] = await this.sql<{ user_id: string }[]>`
      SELECT user_id FROM auth_tokens WHERE refresh_token = ${refreshToken}
    `;
    return row?.user_id ?? null;
  }

  async refresh(
    refreshToken: string,
  ): Promise<{ access_token: string; refresh_token: string } | null> {
    const userId = await this.getUserIdByRefreshToken(refreshToken);
    if (!userId) {
      return null;
    }

    const accessToken = this.jwt.sign({ sub: userId }, { expiresIn: '15m' });
    const newRefreshToken = randomBytes(64).toString('hex');

    await this.saveRefreshToken(userId, newRefreshToken);

    return { access_token: accessToken, refresh_token: newRefreshToken };
  }
}

@Injectable()
export class GoogleTokensService {
  constructor(
    @Inject('SQL') private readonly sql: Sql,
    private readonly cfg: AppConfigService,
  ) {}

  async saveAccessToken(userId: string, accessToken: string, expiresAt: Date) {
    await this.sql`
      INSERT INTO gl_access_tokens (user_id, token, expires_at)
      VALUES (${userId}, ${accessToken}, ${expiresAt})
      ON CONFLICT (user_id) DO UPDATE
      SET token = ${accessToken},
          expires_at = ${expiresAt}
    `;
  }

  async saveRefreshToken(userId: string, refreshToken: string) {
    await this.sql`
      INSERT INTO gl_refresh_tokens (user_id, token)
      VALUES (${userId}, ${refreshToken})
      ON CONFLICT (user_id) DO UPDATE SET token = ${refreshToken}
    `;
  }

  async refreshGoogleAccessToken(
    userId: string,
    refreshToken: string,
  ): Promise<string> {
    const oauth2Client = new google.auth.OAuth2(
      this.cfg.get('google').clientId,
      this.cfg.get('google').clientSecret,
    );

    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const { credentials } = await oauth2Client.refreshAccessToken();

    const accessToken = credentials.access_token!;
    const expiresAt = new Date(credentials.expiry_date!);

    await this.saveAccessToken(userId, accessToken, expiresAt);

    return accessToken;
  }
}

@Injectable()
export class AuthService {
  constructor(@Inject('SQL') private readonly sql: Sql) {}

  async getOrCreateUser(
    email: string,
    name: string | null,
    pictureUrl: string | null,
  ): Promise<User> {
    const [existing] = await this.sql<User[]>`
      SELECT * FROM users WHERE email = ${email}
    `;
    if (existing) return existing;

    const [created] = await this.sql<User[]>`
      INSERT INTO users (email, name, picture_url)
      VALUES (${email}, ${name}, ${pictureUrl})
      RETURNING *
    `;
    return created;
  }
}
