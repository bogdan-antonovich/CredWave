import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import {
  AppTokensService,
  GoogleTokensService,
  AuthService,
} from './auth.service';
import { HttpCode } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import {
  ApiBearerAuth,
  ApiExcludeEndpoint,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

interface AuthenticatedRequest extends Request {
  user: {
    email: string;
    name: string;
    pictureUrl: string;
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
}

const tokenResponseSchema = {
  schema: {
    properties: {
      access_token: { type: 'string', example: 'eyJhbGci...' },
      refresh_token: { type: 'string', example: 'a3f2c1...' },
    },
  },
};

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private jwt: JwtService,
    private readonly appTokens: AppTokensService,
    private readonly googleTokens: GoogleTokensService,
    private readonly authService: AuthService,
    @InjectPinoLogger(AuthController.name)
    private readonly logger: PinoLogger,
  ) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Initiate Google OAuth flow' })
  @ApiExcludeEndpoint()
  googleAuth() {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiExcludeEndpoint()
  async googleCallback(@Req() req: AuthenticatedRequest) {
    this.logger.info('Google callback initiated');

    const user = await this.authService.getOrCreateUser(
      req.user.email,
      req.user.name,
      req.user.pictureUrl,
    );

    const expiresAt = new Date(Date.now() + req.user.expiresIn * 1000);

    await this.googleTokens.saveAccessToken(
      user.id,
      req.user.accessToken,
      expiresAt,
    );

    await this.googleTokens.saveRefreshToken(user.id, req.user.refreshToken);

    const accessToken = this.jwt.sign({ sub: user.id, expiresIn: '15m' });
    const refreshToken = randomBytes(64).toString('hex');

    await this.appTokens.saveRefreshToken(user.id, refreshToken);

    return { access_token: accessToken, refresh_token: refreshToken };
  }

  @Post('signout')
  @HttpCode(204)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sign out and invalidate the current access token' })
  @ApiNoContentResponse()
  async signout(@Req() req: Request) {
    this.logger.info('Signout initiated');
    const token = req.headers.authorization!.split(' ')[1];

    const decoded: { exp: number } = this.jwt.decode(token);
    const expiresAt = new Date(decoded.exp * 1000);

    await this.appTokens.addToBlacklist(token, expiresAt);
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Exchange a refresh token for a new access token',
    description:
      'Pass the refresh token as a Bearer token in the Authorization header.',
  })
  @ApiOkResponse(tokenResponseSchema)
  async refresh(@Req() req: Request) {
    this.logger.info('Refresh tokens initiated');
    const refreshToken = req.headers.authorization!.split(' ')[1];
    if (!refreshToken)
      throw new UnauthorizedException('Refresh token not provided');

    const result = await this.appTokens.refresh(refreshToken);
    if (!result) throw new UnauthorizedException('Invalid refresh token');

    return result;
  }
}
