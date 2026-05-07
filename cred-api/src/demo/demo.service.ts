import { Injectable } from '@nestjs/common';
import { AdminService } from '../admin/admin.service';
import { ReviewsService } from '../restaurants/reviews/reviews.service';
import type { DemoBlock } from '../restaurants/reviews/reviews.types';
import { LogMethods } from 'src/shared/decorators/log-methods.decorator';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@Injectable()
@LogMethods()
export class DemoService {
  protected readonly logger: PinoLogger;

  constructor(
    private readonly adminService: AdminService,
    private readonly reviewsService: ReviewsService,
    @InjectPinoLogger(DemoService.name) logger: PinoLogger,
  ) {
    this.logger = logger;
  }

  async generateDemo(placeId: string, restaurantName: string) {
    return await this.reviewsService.generateDemoBlocks(
      placeId,
      restaurantName,
    );
  }

  async getAdminBlocks(slug: string) {
    const { blocks } = await this.adminService.getBlocks(slug);

    this.logger.debug({ slug }, 'Admin blocks retrieved successfully');

    return {
      blocks: blocks.map((b) => {
        const byTone = Object.fromEntries(
          b.responses.map((r) => [r.tone, r.text]),
        );
        return {
          reviewer_name: b.reviewer_name,
          review_text: b.review_text,
          rating: b.rating,
          empathetic: byTone['empathetic'] ?? '',
          professional: byTone['professional'] ?? '',
          casual: byTone['casual'] ?? '',
          link: b.link,
        } satisfies DemoBlock;
      }),
    };
  }
}
