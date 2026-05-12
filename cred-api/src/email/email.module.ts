import { Module } from '@nestjs/common';
import { EmailService } from './email.serivice';
// Note: filename has a typo (serivice) — intentionally kept to avoid breaking imports

@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
