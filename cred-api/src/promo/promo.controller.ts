import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { PromoService } from './promo.service';

export interface RedeemPromoDto {
  promoCode: string;
}

@ApiTags('Promo')
@Controller('promo')
export class PromoController {
  constructor(
    private readonly promoService: PromoService,
    @InjectPinoLogger(PromoController.name)
    private readonly logger: PinoLogger,
  ) {}

  @Get('/access')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Check if the current user has active promo access',
  })
  @ApiOkResponse({
    schema: {
      properties: { accessUntil: { type: 'string', format: 'date-time' } },
    },
  })
  async checkAccess(@Req() req: Request) {
    this.logger.info('Checking promo access for current user');
    const userId = (req as unknown as { user: { id: number } }).user.id;
    const access = await this.promoService.getPromoAccess(userId);
    if (!access) throw new NotFoundException('No active promo access');
    return access;
  }

  @Post('/redeem')
  @HttpCode(204)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Redeem a promo code for the current user' })
  @ApiNoContentResponse()
  async redeemPromoCode(@Req() req: Request, @Body() body: RedeemPromoDto) {
    this.logger.info('Redeeming promo code for the current user');
    const userId = (req.user as { id: number }).id;
    await this.promoService.redeemPromoCode(body.promoCode, userId);
  }
}
