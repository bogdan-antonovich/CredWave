import { Module } from '@nestjs/common';
import { Paddle, Environment } from '@paddle/paddle-node-sdk';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { AppConfigService } from '../config/config.service';

@Module({
  controllers: [BillingController],
  providers: [
    BillingService,
    {
      provide: 'PADDLE',
      inject: [AppConfigService],
      useFactory: (cfg: AppConfigService) =>
        new Paddle(cfg.get('paddle').apiKey, {
          environment: Environment.sandbox,
        }),
    },
  ],
})
export class BillingModule {}
