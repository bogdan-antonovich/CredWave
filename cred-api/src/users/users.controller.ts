import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { UsersService } from './users.service';
import { NotFoundException } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
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
        google_connected: { type: 'boolean' },
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

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      picture_url: user.picture_url,
      created_at: user.created_at,
      google_connected: !!accessToken,
    };
  }

  @Delete('me/google')
  @HttpCode(204)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disconnect Google account' })
  @ApiNoContentResponse()
  async disconnectGoogle(@Req() req: Request) {
    this.logger.info('Disconnecting Google account');
    const userId = (req.user as { id: string }).id;
    await this.usersService.disconnectGoogle(userId);
  }

  @Delete('me')
  @HttpCode(204)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete account and all associated data' })
  @ApiNoContentResponse()
  async deleteAccount(@Req() req: Request) {
    this.logger.info('Deleting user account');
    const userId = (req.user as { id: string }).id;
    await this.usersService.deleteAccount(userId);
  }
}
