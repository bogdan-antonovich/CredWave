import { Test } from '@nestjs/testing';
import { AiService } from './ai.service';
import { AppConfigService } from '../config/config.service';
import { getLoggerToken } from 'nestjs-pino';
import type OpenAI from 'openai';

type CreateFn = OpenAI['chat']['completions']['create'];

const mockCreate = jest.fn<ReturnType<CreateFn>, Parameters<CreateFn>>();
const openaiMock = { chat: { completions: { create: mockCreate } } };

const FAKE_RESPONSES = {
  empathetic: 'We really appreciate your kind words!',
  professional: 'Thank you for your valuable feedback.',
  casual: 'Awesome, glad you enjoyed it!',
};

function mockOpenAiResponse() {
  mockCreate.mockResolvedValueOnce({
    choices: [
      {
        message: {
          role: 'assistant',
          refusal: null,
          content: JSON.stringify(FAKE_RESPONSES),
        },
      },
    ],
  } as Awaited<ReturnType<CreateFn>>);
}

async function buildService(): Promise<AiService> {
  const configMock: Partial<AppConfigService> = {
    get: jest.fn((key: string) => {
      if (key === 'openai') return { model: 'gpt-4o' };
      throw new Error(`Unknown config key: ${key}`);
    }),
  };
  const module = await Test.createTestingModule({
    providers: [
      AiService,
      { provide: 'OPENAI', useValue: openaiMock },
      { provide: AppConfigService, useValue: configMock },
      {
        provide: getLoggerToken(AiService.name),
        useValue: {
          debug: jest.fn(),
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          trace: jest.fn(),
        },
      },
    ],
  }).compile();
  return module.get<AiService>(AiService);
}

describe('AiService', () => {
  beforeEach(() => jest.resetAllMocks());

  describe('generateReviewResponses', () => {
    it('returns parsed responses from OpenAI', async () => {
      const service = await buildService();
      mockOpenAiResponse();

      const result = await service.generateReviewResponses(
        'Pasta Place',
        'Alice',
        5,
        'Great food!',
      );

      expect(result).toEqual(FAKE_RESPONSES);
    });

    it('calls OpenAI with the configured model', async () => {
      const service = await buildService();
      mockOpenAiResponse();

      await service.generateReviewResponses('Pasta Place', 'Alice', 5, 'Great food!');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gpt-4o' }),
      );
    });

    it('includes additionalContext in the prompt when provided', async () => {
      const service = await buildService();
      mockOpenAiResponse();

      await service.generateReviewResponses(
        'Pasta Place',
        'Alice',
        5,
        'Great food!',
        null,
        'VIP customer',
      );

      const prompt = mockCreate.mock.calls[0][0].messages[0].content as string;
      expect(prompt).toContain('VIP customer');
    });

    it('omits additionalContext block when not provided', async () => {
      const service = await buildService();
      mockOpenAiResponse();

      await service.generateReviewResponses('Pasta Place', 'Alice', 5, 'Great food!');

      const prompt = mockCreate.mock.calls[0][0].messages[0].content as string;
      expect(prompt).not.toContain('Additional context');
    });

    it('includes additionalInfo in the prompt when provided', async () => {
      const service = await buildService();
      mockOpenAiResponse();

      await service.generateReviewResponses(
        'Pasta Place',
        'Alice',
        5,
        'Great food!',
        'Family friendly',
      );

      const prompt = mockCreate.mock.calls[0][0].messages[0].content as string;
      expect(prompt).toContain('Family friendly');
    });

    it('omits additionalInfo block when null', async () => {
      const service = await buildService();
      mockOpenAiResponse();

      await service.generateReviewResponses('Pasta Place', 'Alice', 5, 'Great food!', null);

      const prompt = mockCreate.mock.calls[0][0].messages[0].content as string;
      expect(prompt).not.toContain('About restaurant');
    });
  });
});
