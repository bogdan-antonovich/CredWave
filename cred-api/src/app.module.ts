import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PassportModule } from '@nestjs/passport';
import { GoogleStrategy } from './auth/google.strategy';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './auth/jwt.strategy';
import { DatabaseModule } from './database/database.module';
import { BillingModule } from './billing/billing.module';
import { UsersModule } from './users/users.module';
import { ReviewsModule } from './reviews/reviews.module';
import { AuthModule } from './auth/auth.module';
import { ContactModule } from './contact/contact.module';
import { RestaurantsModule } from './restaurants/restaurants.module';
import { RestaurantsReviewsModule } from './restaurants/reviews/reviews.module';
import { DemoModule } from './demo/demo.module';
import { PromoModule } from './promo/promo.module';
import { AppConfigModule } from './config/config.module';
import { AppConfigService } from './config/config.service';
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    AppConfigModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    LoggerModule.forRootAsync({
      inject: [AppConfigService],
      imports: [AppConfigModule],

      useFactory: (config: AppConfigService) => {
        const isProd = config.get('nodeEnv') === 'production';
        const level = config.get('logLevel');

        const targets: any[] = [
          {
            target: 'pino-pretty',
            level,
            options: { colorize: true, singleLine: true },
          },
        ];

        if (isProd) {
          targets.push({
            target: 'pino-loki',
            level,
            options: {
              host: 'http://loki:3100',
              labels: { app: 'credwave' },
              interval: 5,
              silenceErrors: false,
            },
          });
        }

        return {
          pinoHttp: {
            level,
            quietReqLogger: true,
            serializers: {
              req: (req: { id: unknown; method: unknown; url: unknown }) => ({
                id: req.id,
                method: req.method,
                url: req.url,
              }),
            },
            transport: { targets },
          },
        };
      },
    }),
    DatabaseModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
    PassportModule,
    UsersModule,
    BillingModule,
    ReviewsModule,
    AuthModule,
    ContactModule,
    RestaurantsModule,
    RestaurantsReviewsModule,
    DemoModule,
    PromoModule,
  ],
  providers: [
    GoogleStrategy,
    JwtStrategy,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
