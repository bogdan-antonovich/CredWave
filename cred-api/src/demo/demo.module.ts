import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { RestaurantsReviewsModule } from '../restaurants/reviews/reviews.module';
import { DemoController } from './demo.controller';
import { DemoService } from './demo.service';

@Module({
  imports: [AdminModule, RestaurantsReviewsModule],
  controllers: [DemoController],
  providers: [DemoService],
})
export class DemoModule {}
