import { Injectable, Inject } from '@nestjs/common';
import type { Sql } from 'postgres';
import { ContactForm } from './contact.types';
import { Bot } from 'grammy';
import { AppConfigService } from '../config/config.service';
import { LogMethods } from 'src/shared/decorators/log-methods.decorator';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@LogMethods()
@Injectable()
export class ContactService {
  protected readonly logger: PinoLogger;

  constructor(
    @Inject('SQL') private readonly sql: Sql,
    @Inject('TG_BOT') private readonly bot: Bot,
    private readonly cfg: AppConfigService,
    @InjectPinoLogger(ContactService.name) logger: PinoLogger,
  ) {
    this.logger = logger;
  }

  async newContact(cf: ContactForm) {
    await this
      .sql`INSERT INTO contacts (name, email, message) VALUES (${cf.name}, ${cf.email}, ${cf.message})`;

    await this.bot.api.sendMessage(
      this.cfg.get('tg').chatId,
      `📬 *New Contact Form Submission*\n\n` +
        `👤 *Name:* ${cf.name}\n` +
        `📧 *Email:* ${cf.email}\n` +
        `💬 *Message:*\n${cf.message}`,
      { parse_mode: 'Markdown' },
    );
  }
}
