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

  validate(
    accessToken: string,
    refreshToken: string,
    params: { expires_in: number },
    profile: Profile,
    done: VerifyCallback,
  ) {
    done(null, {
      email: profile.emails![0].value,
      name: profile.displayName,
      pictureUrl: profile.photos![0].value,
      accessToken,
      refreshToken,
      expiresIn: params.expires_in,
    });
  }
}
