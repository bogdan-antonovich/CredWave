import { Module } from '@nestjs/common';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';
import { Bot } from 'grammy';
import { AppConfigService } from '../config/config.service';

@Module({
  controllers: [ContactController],
  providers: [
    ContactService,
    {
      provide: 'TG_BOT',
      useFactory: (cfg: AppConfigService) => {
        return new Bot(cfg.get('tg').botToken);
      },
      inject: [AppConfigService],
    },
  ],
})
export class ContactModule {}
