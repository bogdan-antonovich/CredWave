import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { UsersService } from './users.service';
import {
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    @InjectPinoLogger(UsersController.name)
    private readonly logger: PinoLogger,
  ) {}

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the current user profile' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        email: { type: 'string', format: 'email' },
        name: { type: 'string' },
        picture_url: { type: 'string', format: 'uri' },
        created_at: { type: 'string', format: 'date-time' },
        google_access_token_valid: { type: 'boolean' },
      },
    },
  })
  async getMe(@Req() req: Request) {
    this.logger.info('Fetching user info');
    const userId = (req.user as { id: string }).id;
    const user = await this.usersService.getUserbyId(userId);
    if (!user) throw new NotFoundException('User not found');

    const accessToken = await this.usersService.getGoogleAccessTokenByUserId(
      user.id,
    );
    if (!accessToken)
      throw new NotFoundException('Google access token not found');

    let googleAccessTokenValid = false;
    try {
      googleAccessTokenValid =
        await this.usersService.isGoogleTokenValid(accessToken);
    } catch {
      throw new InternalServerErrorException(`Failed to validate Google token`);
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      picture_url: user.picture_url,
      created_at: user.created_at,
      google_access_token_valid: googleAccessTokenValid,
    };
  }
}
