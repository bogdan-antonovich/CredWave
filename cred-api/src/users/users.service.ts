import { Injectable, Inject } from '@nestjs/common';
import type { Sql } from 'postgres';
import type { User } from '../shared/types';
import { LogMethods } from 'src/shared/decorators/log-methods.decorator';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@LogMethods()
@Injectable()
export class UsersService {
  protected readonly logger: PinoLogger;

  constructor(
    @Inject('SQL') private readonly sql: Sql,
    @InjectPinoLogger(UsersService.name) logger: PinoLogger,
  ) {
    this.logger = logger;
  }

  async getUserbyId(userId: string) {
    this.logger.info({ userId }, 'getUserbyId called');
    const [row] = await this.sql<User[]>`
    SELECT id, email, name, picture_url, created_at
    FROM users
    WHERE id = ${userId}
  `;
    this.logger.debug({ userId, found: !!row }, 'getUserbyId result');
    return row ?? null;
  }

  async getGoogleAccessTokenByUserId(userId: string): Promise<string | null> {
    const [row] = await this.sql<{ token: string }[]>`
      SELECT token
      FROM gl_access_tokens
      WHERE user_id = ${userId}
    `;
    return row?.token ?? null;
  }

  async isGoogleTokenValid(accessToken: string): Promise<boolean> {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${accessToken}`,
    );
    return res.ok;
  }
}
