import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { PromoController } from './promo.controller';
import { PromoService } from './promo.service';
import { PromoNotificationsService } from './promo.notifications.service';

@Module({
  imports: [AuthModule, EmailModule],
  controllers: [PromoController],
  providers: [PromoService, PromoNotificationsService],
})
export class PromoModule {}
