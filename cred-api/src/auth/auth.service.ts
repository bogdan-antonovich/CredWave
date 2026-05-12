import { Injectable, Inject } from '@nestjs/common';
import type { Sql } from 'postgres';
import type { User } from '../shared/types';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import { google } from 'googleapis';
import { AppConfigService } from '../config/config.service';
import { EmailService } from '../email/email.serivice';
import { LogMethods } from 'src/shared/decorators/log-methods.decorator';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@LogMethods()
@Injectable()
export class AppTokensService {
  protected readonly logger: PinoLogger;

  constructor(
    @Inject('SQL') private readonly sql: Sql,
    private jwt: JwtService,
    @InjectPinoLogger(AppTokensService.name) logger: PinoLogger,
  ) {
    this.logger = logger;
  }

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
      this.logger.warn('userId not found for refresh token');
      return null;
    }

    const accessToken = this.jwt.sign({ sub: userId }, { expiresIn: '15m' });
    const newRefreshToken = randomBytes(64).toString('hex');

    await this.saveRefreshToken(userId, newRefreshToken);

    this.logger.debug({ userId }, 'Refreshed token pair');

    return { access_token: accessToken, refresh_token: newRefreshToken };
  }
}

@LogMethods()
@Injectable()
export class GoogleTokensService {
  protected readonly logger: PinoLogger;

  constructor(
    @Inject('SQL') private readonly sql: Sql,
    private readonly cfg: AppConfigService,
    @InjectPinoLogger(GoogleTokensService.name) logger: PinoLogger,
  ) {
    this.logger = logger;
  }

  async getAccessToken(userId: string): Promise<string | null> {
    const [row] = await this.sql<{ token: string }[]>`
      SELECT token FROM gl_access_tokens WHERE user_id = ${userId}
    `;
    return row?.token ?? null;
  }

  async getRefreshToken(userId: string): Promise<string> {
    const [row] = await this.sql<{ token: string }[]>`
      SELECT token FROM gl_refresh_tokens WHERE user_id = ${userId}
    `;
    if (!row?.token)
      throw new Error(`No Google refresh token for user ${userId}`);
    return row.token;
  }

  async withAutoRefresh<T>(
    userId: string,
    fn: (token: string) => Promise<T>,
  ): Promise<T> {
    const token = await this.getAccessToken(userId);
    try {
      return await fn(token!);
    } catch (err) {
      if (!isGoogleAuthError(err)) throw err;
      this.logger.warn({ userId }, 'Google access token expired, refreshing');
      const refreshToken = await this.getRefreshToken(userId);
      const newToken = await this.refreshGoogleAccessToken(
        userId,
        refreshToken,
      );
      return fn(newToken);
    }
  }

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

    this.logger.debug({ userId }, 'Refreshed google access token');

    return accessToken;
  }
}

@LogMethods()
@Injectable()
export class AuthService {
  protected readonly logger: PinoLogger;

  constructor(
    @Inject('SQL') private readonly sql: Sql,
    private readonly email: EmailService,
    @InjectPinoLogger(AuthService.name) logger: PinoLogger,
  ) {
    this.logger = logger;
  }

  async getOrCreateUser(
    email: string,
    name: string | null,
    pictureUrl: string | null,
  ): Promise<User> {
    const [existing] = await this.sql<User[]>`
      SELECT * FROM users WHERE email = ${email}
    `;
    if (existing) {
      this.logger.debug({ userId: existing.id, email }, 'User already exists');
      return existing;
    }

    const [created] = await this.sql<User[]>`
      INSERT INTO users (email, name, picture_url)
      VALUES (${email}, ${name}, ${pictureUrl})
      RETURNING *
    `;
    this.logger.debug({ userId: created.id, email }, 'Created new user');

    void this.email.sendWelcome(created.email, created.name ?? 'there');

    return created;
  }

  async handleLoginIp(userId: string, ip: string, userEmail: string, userName: string) {
    const [row] = await this.sql<{ last_login_ip: string | null }[]>`
      SELECT last_login_ip FROM users WHERE id = ${userId}
    `;

    if (row?.last_login_ip && row.last_login_ip !== ip) {
      const time = new Date().toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short',
      });
      void this.email.sendNewLogin(userEmail, userName ?? 'there', ip, time);
    }

    await this.sql`
      UPDATE users SET last_login_ip = ${ip}, last_login_at = NOW() WHERE id = ${userId}
    `;
  }
}

function isGoogleAuthError(err: unknown): boolean {
  const e = err as { response?: { status?: number } };
  return e?.response?.status === 401;
}
