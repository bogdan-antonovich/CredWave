import { Module } from '@nestjs/common';
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
import { AppConfigModule } from './config/config.module';
import { AppConfigService } from './config/config.service';
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    AppConfigModule,
    LoggerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => {
        const isProd = config.get('nodeEnv') === 'production';
        // const level = config.get('logLevel');
        const level = 'debug';

        const targets: any[] = [
          {
            target: 'pino-pretty',
            level,
            options: { colorize: true, singleLine: false },
          },
        ];

        if (isProd) {
          targets.push({
            target: 'pino-loki',
            level,
            options: {
              host: 'http://loki:3199',
              labels: { app: 'credwave' },
              interval: 5,
              silenceErrors: false,
            },
          });
        }

        return {
          pinoHttp: {
            level,
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
  ],
  providers: [GoogleStrategy, JwtStrategy],
})
export class AppModule {}
