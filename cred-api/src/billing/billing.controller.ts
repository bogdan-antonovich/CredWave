import {
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
  Param,
  Headers,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
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

  @Post('subscription/cancel')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel the current subscription at period end' })
  @ApiOkResponse({ description: 'Cancellation scheduled' })
  async cancelSubscription(@Req() req: Request) {
    this.logger.info('Cancelling subscription');
    const userId = (req.user as { id: string }).id;
    await this.srv.cancelSubscription(userId);
    return { ok: true };
  }

  @Post('subscription/reactivate')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Reactivate a subscription scheduled for cancellation',
  })
  @ApiOkResponse({ description: 'Subscription reactivated' })
  async reactivateSubscription(@Req() req: Request) {
    this.logger.info('Reactivating subscription');
    const userId = (req.user as { id: string }).id;
    await this.srv.reactivateSubscription(userId);
    return { ok: true };
  }

  @Post('subscription/change')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change the plan for the current subscription' })
  @ApiOkResponse({ description: 'Plan change initiated' })
  async changePlan(
    @Req() req: Request,
    @Body() body: { priceId: string; planName: string },
  ) {
    const { priceId, planName } = body;
    if (!priceId || !planName)
      throw new BadRequestException('priceId and planName are required');
    const userId = (req.user as { id: string }).id;
    this.logger.info({ planName }, 'Changing subscription plan');
    await this.srv.changePlan(userId, priceId, planName);
    return { ok: true };
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
  @SkipThrottle()
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

  @Get('invoice/:invoiceId')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get the download link for an invoice',
  })
  @ApiOkResponse({
    schema: {
      properties: {
        url: {
          type: 'string',
          format: 'uri',
          example: '.',
        },
      },
    },
  })
  async getDowndloadInvoiceLink(@Param('invoiceId') invoiceId: string) {
    this.logger.info(`Getting download link for invoice ${invoiceId}`);
    return await this.srv.getDownloadLink(invoiceId);
  }
}
