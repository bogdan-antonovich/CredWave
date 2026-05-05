import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import {
  AuthService,
  AppTokensService,
  GoogleTokensService,
} from './auth.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, AppTokensService, GoogleTokensService],
  exports: [AppTokensService],
})
export class AuthModule {}
