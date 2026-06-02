import { Injectable, Inject } from '@nestjs/common';
import OpenAI from 'openai';
import { AppConfigService } from '../config/config.service';
import { LogMethods } from './decorators/log-methods.decorator';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@LogMethods()
@Injectable()
export class AiService {
  protected readonly logger: PinoLogger;

  constructor(
    @Inject('OPENAI') private readonly openai: OpenAI,
    private readonly cfg: AppConfigService,
    @InjectPinoLogger(AiService.name) logger: PinoLogger,
  ) {
    this.logger = logger;
  }

  async generateReviewResponses(
    restaurantName: string,
    reviewerName: string,
    rating: number,
    reviewText: string,
    additionalInfo?: string | null,
    additionalContext?: string,
  ): Promise<{ empathetic: string; professional: string; casual: string }> {
    const prompt = `
      You are an employee of a restaurant ${restaurantName};
      Your job is to create 3 different responses to a review you are going to be given;
      ${additionalInfo ? `About restaurant: ${additionalInfo};` : ''}
      Reviewer: ${reviewerName};
      Rating: ${rating}/5;
      Review: ${reviewText};
      ${additionalContext ? `Additional context: ${additionalContext};` : ''}

      Return only a JSON object, no markdown:
      {
        "empathetic": "...",
        "professional": "...",
        "casual": "..."
      }
    `;

    const completion = await this.openai.chat.completions.create({
      model: this.cfg.get('openai').model,
      messages: [{ role: 'developer', content: prompt }],
      response_format: { type: 'json_object' },
    });

    return JSON.parse(completion.choices[0].message.content!) as {
      empathetic: string;
      professional: string;
      casual: string;
    };
  }
}
