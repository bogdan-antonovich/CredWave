import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ContactForm } from './contact.types';
import { ContactService } from './contact.service';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@ApiTags('Contact')
@Controller('contact')
export class ContactController {
  constructor(
    private readonly srv: ContactService,
    @InjectPinoLogger(ContactController.name)
    private readonly logger: PinoLogger,
  ) {}

  @Post()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({ summary: 'Submit a contact form message' })
  @ApiBody({
    schema: {
      required: ['name', 'email', 'message'],
      properties: {
        name: { type: 'string', example: 'John Doe' },
        email: { type: 'string', format: 'email', example: 'john@example.com' },
        message: {
          type: 'string',
          example: 'I have a question about pricing.',
        },
      },
    },
  })
  @ApiOkResponse({
    schema: {
      properties: {
        success: { type: 'boolean', example: true },
        message: {
          type: 'string',
          example: "We'll get back to you within 24 hours.",
        },
      },
    },
  })
  async sendContact(@Body() body: ContactForm) {
    this.logger.info('Contact form submission received');
    await this.srv.newContact(body);
    return {
      success: true,
      message: "We'll get back to you within 24 hours.",
    };
  }
}
