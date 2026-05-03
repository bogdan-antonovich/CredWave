import { Controller, Get, Post, Req, UseGuards, Headers } from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { BillingService } from './billing.service';
import { AuthGuard } from '@nestjs/passport';
import type { RawBodyRequest } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@ApiTags('Billing')
@Controller('billing')
export class BillingController {
  constructor(
    private readonly srv: BillingService,
    @InjectPinoLogger(BillingController.name)
    private readonly logger: PinoLogger,
  ) {}

  @Get('subscription')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the active subscription for the current user' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        status: {
          type: 'string',
          enum: ['active', 'trialing', 'past_due', 'canceled'],
        },
        plan: { type: 'string' },
        currentPeriodEnd: { type: 'string', format: 'date-time' },
      },
    },
  })
  async getSubscription(@Req() req: Request) {
    this.logger.info("Getting a user's subscription info");
    const userId = (req.user as { id: string }).id;
    const subscription = await this.srv.getSubscription(userId);
    if (!subscription)
      throw new NotFoundException('No active subscription found');
    return subscription;
  }

  @Get('invoices')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List invoices for the current user' })
  @ApiOkResponse({
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          amount: { type: 'number' },
          currency: { type: 'string', example: 'USD' },
          status: { type: 'string', enum: ['paid', 'unpaid', 'void'] },
          createdAt: { type: 'string', format: 'date-time' },
          pdfUrl: { type: 'string', format: 'uri' },
        },
      },
    },
  })
  async getInvoices(@Req() req: Request) {
    this.logger.info("Getting a user's invoices");
    const userId = (req.user as { id: string }).id;
    return await this.srv.getInvoices(userId);
  }

  @Post('portal')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Open the Paddle customer portal for the current user',
  })
  @ApiOkResponse({
    schema: {
      properties: {
        url: {
          type: 'string',
          format: 'uri',
          example: 'https://portal.paddle.com/...',
        },
      },
    },
  })
  async openPortal(@Req() req: Request) {
    this.logger.info('Opening Paddle customer portal');
    const userId = (req.user as { id: string }).id;
    return await this.srv.openPortal(userId);
  }

  @Post('webhooks/paddle')
  @ApiOperation({ summary: 'Paddle webhook receiver' })
  @ApiHeader({
    name: 'paddle-signature',
    description: 'Paddle webhook signature for payload verification',
    required: true,
  })
  @ApiOkResponse({ description: 'Webhook processed' })
  async handlePaddleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('paddle-signature') signature: string,
  ) {
    this.logger.info('Received Paddle webhook');
    return await this.srv.handleWebhook(req.rawBody!, signature);
  }
}
