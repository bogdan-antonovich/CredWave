import { Module } from '@nestjs/common';
import { Paddle, Environment } from '@paddle/paddle-node-sdk';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { AppConfigService } from '../config/config.service';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [EmailModule],
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
  exports: ['PADDLE'],
})
export class BillingModule {}
