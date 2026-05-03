import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppTokensService } from './auth.service';
import { UnauthorizedException } from '@nestjs/common';
import { AppConfigService } from '../config/config.service';
import { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    cfg: AppConfigService,
    private readonly appTokens: AppTokensService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: cfg.get('jwt').secret,
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: { sub: string }) {
    const token = req.headers.authorization!.split(' ')[1];
    const isBlacklisted = await this.appTokens.isBlacklisted(token);
    if (isBlacklisted) throw new UnauthorizedException();
    return { id: payload.sub };
  }
}
