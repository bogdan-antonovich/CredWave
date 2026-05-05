import {
  Controller,
  Get,
  Req,
  Patch,
  Query,
  Param,
  UseGuards,
  HttpCode,
  Body,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { RestaurantsService } from './restaurants.service';
import type { RestaurantChanges, AutoReplyChanges } from './restaurants.types';
import { BadRequestException } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

const restaurantSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    slug: { type: 'string' },
    address: { type: 'string', nullable: true },
    ownerName: { type: 'string', nullable: true },
    additionalInfo: { type: 'string', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

@ApiTags('Restaurants')
@Controller('restaurants')
export class RestaurantsController {
  constructor(
    private readonly restaurantsService: RestaurantsService,
    @InjectPinoLogger(RestaurantsController.name)
    private readonly logger: PinoLogger,
  ) {}

  @Get()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List restaurants for the current user' })
  @ApiOkResponse({
    schema: { type: 'array', items: restaurantSchema },
  })
  async getRestaurants(@Req() req: Request) {
    this.logger.info('Fetching restaurants of the current user');
    const userId = (req.user as { id: string }).id;
    return await this.restaurantsService.getRestaurants(userId);
  }

  @Patch(':id')
  @HttpCode(204)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update restaurant info' })
  @ApiParam({ name: 'id' })
  @ApiBody({
    schema: {
      properties: {
        name: { type: 'string' },
        ownerName: { type: 'string' },
        additionalInfo: { type: 'string' },
      },
    },
  })
  @ApiNoContentResponse()
  async updateRestaurantInfo(
    @Param('id') id: string,
    @Body() body: RestaurantChanges,
  ) {
    this.logger.info('Updating restaurant additional info');
    await this.restaurantsService.updateRestaurantInfo(id, body);
  }

  @Get(':id/auto-reply')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get auto-reply settings for a restaurant' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' },
        defaultTone: {
          type: 'string',
          enum: ['empathetic', 'professional', 'casual'],
        },
        customInstructions: { type: 'string' },
      },
    },
  })
  async getAutoReply(@Param('id') id: string) {
    this.logger.info('Fetching auto-reply settings for restaurant');
    return await this.restaurantsService.getAutoReply(id);
  }

  @Patch(':id/auto-reply')
  @HttpCode(204)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update auto-reply settings for a restaurant' })
  @ApiParam({ name: 'id' })
  @ApiBody({
    schema: {
      properties: {
        enabled: { type: 'boolean' },
        defaultTone: {
          type: 'string',
          enum: ['empathetic', 'professional', 'casual'],
        },
        customInstructions: { type: 'string' },
      },
    },
  })
  @ApiNoContentResponse()
  async updateAutoReply(
    @Param('id') id: string,
    @Body() body: AutoReplyChanges,
  ) {
    this.logger.info('Updating auto-reply settings for restaurant');
    await this.restaurantsService.updateAutoReply(id, body);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search restaurants by name (public)' })
  @ApiQuery({ name: 'q', description: 'Search query', example: 'Bella' })
  @ApiOkResponse({
    schema: {
      type: 'array',
      items: restaurantSchema,
    },
  })
  async searchRestaurants(@Query('q') query: string) {
    this.logger.info('Searching restaurants', { query });
    if (!query) throw new BadRequestException('Query is required');
    return await this.restaurantsService.searchRestaurants(query);
  }
}
