import { Module } from '@nestjs/common';
import OpenAI from 'openai';
import { AppConfigService } from 'src/config/config.service';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [AuthModule, EmailModule],
  controllers: [ReviewsController],
  providers: [
    ReviewsService,
    {
      provide: 'OPENAI',
      inject: [AppConfigService],
      useFactory: (cfg: AppConfigService) =>
        new OpenAI({
          apiKey: cfg.get('openai').apiKey,
        }),
    },
  ],
})
export class ReviewsModule {}
