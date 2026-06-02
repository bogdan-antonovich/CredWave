import { AdminGuard } from '../shared/guards/admin.guard';
import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AppConfigService } from '../config/config.service';
import { AiService } from '../shared/ai.service';
import OpenAI from 'openai';

@Module({
  controllers: [AdminController],
  providers: [
    AdminService,
    AiService,
    AdminGuard,
    {
      provide: 'OPENAI',
      useFactory: (cfg: AppConfigService) =>
        new OpenAI({ apiKey: cfg.get('openai').apiKey }),
      inject: [AppConfigService],
    },
  ],
  exports: [AdminService],
})
export class AdminModule {}
