import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { DemoService } from './demo.service';

@ApiTags('Demo')
@Controller('demo')
export class DemoController {
  constructor(private readonly demoService: DemoService) {}

  @Post('generate')
  @HttpCode(200)
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
  async generateDemo(@Body() body: { place_id: string; name: string }) {
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
