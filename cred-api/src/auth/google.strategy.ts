import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { Profile } from 'passport-google-oauth20';
import { AppConfigService } from '../config/config.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(cfg: AppConfigService) {
    super({
      clientID: cfg.get('google').clientId,
      clientSecret: cfg.get('google').clientSecret,
      callbackURL: cfg.get('google').callbackUrl,
      scope: [
        'email',
        'profile',
        'https://www.googleapis.com/auth/business.manage',
      ],
    });
  }

  authorizationParams(): object {
    return {
      access_type: 'offline',
      prompt: 'consent',
    };
  }

  validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ) {
    done(null, {
      email: profile.emails?.[0]?.value ?? null,
      name: profile.displayName,
      pictureUrl: profile.photos?.[0]?.value ?? null,
      accessToken,
      refreshToken,
      expiresIn: 3600,
    });
  }
}
