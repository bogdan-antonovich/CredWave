import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import {
  AuthService,
  AppTokensService,
  GoogleTokensService,
} from './auth.service';
import { DatabaseModule } from '../database/database.module';
import { AppConfigModule } from '../config/config.module';
import { AppConfigService } from '../config/config.service';

@Module({
  imports: [
    DatabaseModule,
    AppConfigModule,
    JwtModule.registerAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (cfg: AppConfigService) => ({
        secret: cfg.get('jwt').secret,
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AppTokensService, GoogleTokensService],
  exports: [AppTokensService],
})
export class AuthModule {}
