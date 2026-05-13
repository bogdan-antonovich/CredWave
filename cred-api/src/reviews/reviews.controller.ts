import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { ReviewsService } from './reviews.service';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

export class GenerateReviewBody {
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  additionalContext?: string;
}

export class ReviewText {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
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
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
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
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: GenerateReviewBody,
  ) {
    this.logger.info('Generating responses for review');
    const userId = (req.user as { id: string }).id;
    return await this.srv.generateResponses(id, userId, body.additionalContext);
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
  async replyReview(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: ReviewText,
  ) {
    this.logger.info('Posting reply to review');
    const userId = (req.user as { id: string }).id;
    return await this.srv.replyToReview(id, userId, body.text);
  }
}
