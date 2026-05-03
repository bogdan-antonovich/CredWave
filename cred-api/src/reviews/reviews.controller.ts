import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ReviewsService } from './reviews.service';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

export interface GenerateReviewBody {
  additionalContext?: string;
}

export interface ReviewText {
  text: string;
}

const generatedResponseSchema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      tone: { type: 'string', enum: ['empathetic', 'professional', 'casual'] },
      text: { type: 'string' },
    },
  },
};

@ApiTags('Reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(
    private readonly srv: ReviewsService,
    @InjectPinoLogger(ReviewsController.name)
    private readonly logger: PinoLogger,
  ) {}

  @Post(':id/generate')
  @ApiOperation({ summary: 'Generate AI reply options for a review' })
  @ApiParam({ name: 'id', description: 'Review ID' })
  @ApiBody({
    schema: {
      properties: {
        additionalContext: {
          type: 'string',
          example: 'Mention our new tasting menu launching next week.',
        },
      },
    },
  })
  @ApiOkResponse({ schema: generatedResponseSchema })
  async createReview(
    @Param('id') id: string,
    @Body() body: GenerateReviewBody,
  ) {
    this.logger.info('Generating responses for review');
    return await this.srv.generateResponses(id, body.additionalContext);
  }

  @Post(':id/reply')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Post a reply to a Google review' })
  @ApiParam({ name: 'id', description: 'Review ID' })
  @ApiBody({
    schema: {
      required: ['text'],
      properties: {
        text: {
          type: 'string',
          example: 'Thank you for your kind words!',
        },
      },
    },
  })
  @ApiOkResponse({ description: 'Reply posted to Google Business Profile' })
  async replyReview(@Param('id') id: string, @Body() body: ReviewText) {
    this.logger.info('Posting reply to review');
    return await this.srv.replyToReview(id, body.text);
  }
}
