import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AdminGuard } from '../shared/guards/admin.guard';
import { AdminService } from './admin.service';
import type {
  RestaurantCredentials,
  ReviewBlock,
  PromoCode,
} from './admin.types';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@ApiTags('Admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    @InjectPinoLogger(AdminController.name)
    private readonly logger: PinoLogger,
  ) {}

  @Get('restaurants')
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all restaurants' })
  @ApiOkResponse({
    schema: {
      properties: {
        restaurants: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  async getRestaurants() {
    this.logger.info('Getting demo restaurants');
    return await this.adminService.getRestaurants();
  }

  @Post('restaurants')
  @HttpCode(201)
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a new restaurant' })
  @ApiBody({
    schema: {
      required: ['name', 'slug'],
      properties: {
        name: { type: 'string', example: 'Bella Napoli' },
        slug: { type: 'string', example: 'bella-napoli' },
      },
    },
  })
  @ApiCreatedResponse({
    schema: {
      properties: { id: { type: 'integer', example: 1 } },
    },
  })
  async addRestaurant(@Body() body: RestaurantCredentials) {
    this.logger.info('Adding a demo restaurant');
    return await this.adminService.addRestaurant(body);
  }

  @Delete('restaurants/:slug')
  @HttpCode(204)
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a restaurant' })
  @ApiParam({ name: 'slug', example: 'bella-napoli' })
  @ApiNoContentResponse()
  async deleteRestaurant(@Param('slug') slug: string) {
    this.logger.info('Deleting a demo restaurant');
    return await this.adminService.deleteRestaurant(slug);
  }

  @Get('restaurants/:slug')
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get review blocks for a restaurant' })
  @ApiParam({ name: 'slug', example: 'bella-napoli' })
  @ApiOkResponse({
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          restaurantName: { type: 'string' },
          reviewerName: { type: 'string' },
          reviewText: { type: 'string' },
          rating: { type: 'number', minimum: 1, maximum: 5 },
          responses: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                text: { type: 'string' },
                tone: { type: 'string' },
              },
            },
          },
        },
      },
    },
  })
  async getBlocks(@Param('slug') slug: string) {
    this.logger.info('Getting review blocks for a demo restaurant');
    return await this.adminService.getBlocks(slug);
  }

  @Put('blocks/:id')
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a review block' })
  @ApiParam({ name: 'id', type: 'integer' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        restaurantName: { type: 'string' },
        reviewerName: { type: 'string' },
        reviewText: { type: 'string' },
        rating: { type: 'number', minimum: 1, maximum: 5 },
        responses: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              tone: {
                type: 'string',
                enum: ['empathetic', 'professional', 'casual'],
              },
            },
          },
        },
      },
    },
  })
  @ApiOkResponse({ description: 'Block updated' })
  async updateBlock(@Param('id') id: string, @Body() body: ReviewBlock) {
    this.logger.info('Updating a demo review block');
    return await this.adminService.updateBlock(Number(id), body);
  }

  @Post('restaurants/:slug/blocks')
  @HttpCode(201)
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a review block to a restaurant' })
  @ApiParam({ name: 'slug', example: 'bella-napoli' })
  @ApiBody({
    schema: {
      required: ['reviewerName', 'reviewText', 'rating', 'responses'],
      properties: {
        reviewerName: { type: 'string' },
        reviewText: { type: 'string' },
        rating: { type: 'number', minimum: 1, maximum: 5 },
        responses: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              tone: {
                type: 'string',
                enum: ['empathetic', 'professional', 'casual'],
              },
            },
          },
        },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Block created' })
  async createBlock(@Param('slug') slug: string, @Body() body: ReviewBlock) {
    this.logger.info('Creating a new demo review block');
    return await this.adminService.createBlock(slug, body);
  }

  @Delete('blocks/:id')
  @HttpCode(204)
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a review block' })
  @ApiParam({ name: 'id', type: 'integer' })
  @ApiNoContentResponse()
  async deleteBlock(@Param('id') id: string) {
    this.logger.info('Deleting a demo review block');
    return await this.adminService.deleteBlock(Number(id));
  }

  @Post('/promo-codes')
  @HttpCode(204)
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new promo code' })
  @ApiBody({
    schema: {
      required: ['code', 'durationDays'],
      properties: {
        code: { type: 'string' },
        durationDays: { type: 'integer' },
        expiresAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  async createPromoCode(@Body() body: PromoCode) {
    this.logger.info('Creating a new promo code');
    return await this.adminService.createPromoCode(body);
  }

  @Get('/promo-codes')
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all promo codes' })
  @ApiOkResponse({
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          durationDays: { type: 'integer' },
          expiresAt: { type: 'string', format: 'date-time' },
          maxUses: { type: 'integer' },
          useCount: { type: 'integer' },
          isActive: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  async getPromoCodes() {
    this.logger.info('Getting all promo codes');
    return await this.adminService.getPromoCodes();
  }

  @Patch('/promo-codes/:code')
  @HttpCode(204)
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a promo code' })
  @ApiParam({ name: 'code', type: 'string' })
  @ApiBody({
    schema: {
      required: ['durationDays', 'isActive'],
      properties: {
        durationDays: { type: 'integer' },
        maxUses: { type: 'integer' },
        expiresAt: { type: 'string', format: 'date-time' },
        isActive: { type: 'boolean' },
      },
    },
  })
  @ApiNoContentResponse()
  async updatePromoCode(
    @Param('code') code: string,
    @Body() body: { durationDays: number; maxUses?: number; expiresAt?: string; isActive: boolean },
  ) {
    this.logger.info('Updating a promo code');
    return await this.adminService.updatePromoCode(code, body);
  }

  @Delete('/promo-codes/:code')
  @HttpCode(204)
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a promo code' })
  @ApiParam({ name: 'code', type: 'string' })
  @ApiNoContentResponse()
  async deletePromoCode(@Param('code') code: string) {
    this.logger.info('Deleting a promo code');
    return await this.adminService.deletePromoCode(code);
  }
}
