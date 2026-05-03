import { Controller, Get, Post, Query, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ReviewsService } from './reviews.service';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

const reviewSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    restaurantId: { type: 'string' },
    reviewerName: { type: 'string' },
    rating: { type: 'number', minimum: 1, maximum: 5 },
    text: { type: 'string' },
    status: { type: 'string', enum: ['pending', 'replied', 'ignored'] },
    createdAt: { type: 'string', format: 'date-time' },
  },
};

@ApiTags('Restaurant Reviews')
@Controller('restaurants/:id/reviews')
export class ReviewsController {
  constructor(
    private readonly serv: ReviewsService,
    @InjectPinoLogger(ReviewsController.name)
    private readonly logger: PinoLogger,
  ) {}

  @Get()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List reviews for a restaurant' })
  @ApiParam({ name: 'id', description: 'Restaurant ID' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['all', 'pending', 'replied', 'ignored'],
    example: 'all',
  })
  @ApiQuery({ name: 'page', required: false, example: '1' })
  @ApiQuery({ name: 'per_page', required: false, example: '20' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: reviewSchema },
        total: { type: 'integer' },
        page: { type: 'integer' },
        perPage: { type: 'integer' },
      },
    },
  })
  async getReviews(
    @Param('id') id: string,
    @Query('status') status: string = 'all',
    @Query('page') page: string = '1',
    @Query('per_page') perPage: string = '20',
  ) {
    this.logger.info('Fetching reviews for restaurant');
    const pageNum = Math.max(1, parseInt(page));
    const perPageNum = Math.min(50, Math.max(1, parseInt(perPage)));

    return await this.serv.getReviews(id, status, pageNum, perPageNum);
  }

  @Get('/demo')
  @ApiOperation({
    summary: 'Get demo reviews for a Google Place ID (public)',
  })
  @ApiParam({ name: 'id', description: 'Google Place ID' })
  @ApiOkResponse({
    schema: { type: 'array', items: reviewSchema },
  })
  async getDemoReviews(@Param('id') placeId: string) {
    this.logger.info('Fetching demo reviews for place');
    return await this.serv.getDemoReviews(placeId);
  }

  @Post('sync')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Trigger a manual sync of reviews from Google Business Profile',
  })
  @ApiParam({ name: 'id', description: 'Restaurant ID' })
  @ApiOkResponse({ description: 'Sync initiated' })
  async syncReviews(@Param('id') id: string) {
    this.logger.info('Initiating review sync');
    return await this.serv.syncReviews(id);
  }
}
