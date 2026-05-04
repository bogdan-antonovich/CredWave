import { Injectable } from '@nestjs/common';
import { AdminService } from '../admin/admin.service';
import { ReviewsService } from '../restaurants/reviews/reviews.service';
import type { DemoBlock } from '../restaurants/reviews/reviews.types';

@Injectable()
export class DemoService {
  constructor(
    private readonly adminService: AdminService,
    private readonly reviewsService: ReviewsService,
  ) {}

  async generateDemo(placeId: string, restaurantName: string) {
    return await this.reviewsService.generateDemoBlocks(
      placeId,
      restaurantName,
    );
  }

  async getAdminBlocks(slug: string) {
    const { blocks } = await this.adminService.getBlocks(slug);

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
        } satisfies DemoBlock;
      }),
    };
  }
}
