import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { DemoService } from './demo.service';

class GenerateDemoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  place_id: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;
}

@ApiTags('Demo')
@Controller('demo')
export class DemoController {
  constructor(private readonly demoService: DemoService) {}

  @Post('generate')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({
    summary:
      "Fetch a restaurant's Google reviews and generate AI replies (public)",
  })
  @ApiBody({
    schema: {
      required: ['place_id', 'name'],
      properties: {
        place_id: { type: 'string', example: 'ChIJ...' },
        name: { type: 'string', example: 'Bella Napoli' },
      },
    },
  })
  @ApiOkResponse({
    description: 'Review blocks with empathetic/professional/casual AI replies',
  })
  async generateDemo(@Body() body: GenerateDemoDto) {
    return await this.demoService.generateDemo(body.place_id, body.name);
  }

  @Get('restaurants/:slug')
  @ApiOperation({
    summary: 'Get admin-curated demo blocks for a restaurant (public)',
  })
  @ApiParam({ name: 'slug', example: 'bella-napoli' })
  @ApiOkResponse({ description: 'Pre-seeded review blocks managed by admin' })
  async getAdminBlocks(@Param('slug') slug: string) {
    return await this.demoService.getAdminBlocks(slug);
  }
}
