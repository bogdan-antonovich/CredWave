import { Test } from '@nestjs/testing';
import { NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { AppConfigService } from 'src/config/config.service';
import { getLoggerToken } from 'nestjs-pino';
import type OpenAI from 'openai';

type CreateFn = OpenAI['chat']['completions']['create'];
type SqlMock = jest.Mock<
  Promise<unknown[]>,
  [TemplateStringsArray, ...unknown[]]
>;

const mockCreate = jest.fn<ReturnType<CreateFn>, Parameters<CreateFn>>();

const openaiMock: { chat: { completions: { create: typeof mockCreate } } } = {
  chat: { completions: { create: mockCreate } },
};

function makeSql(...rowSets: Record<string, unknown>[][]): SqlMock {
  let callIndex = 0;
  return jest
    .fn<Promise<unknown[]>, [TemplateStringsArray, ...unknown[]]>()
    .mockImplementation(() => Promise.resolve(rowSets[callIndex++] ?? []));
}

async function buildService(sql: SqlMock): Promise<ReviewsService> {
  (sql as any).json = jest.fn((x: unknown) => x);
  (sql as any).unsafe = jest.fn((x: unknown) => x);
  const configMock: Partial<AppConfigService> = {
    get: jest.fn((key: string) => {
      if (key === 'openai') return { model: 'gpt-4o' };
      throw new Error(`Unknown config key: ${key}`);
    }),
  };
  const module = await Test.createTestingModule({
    providers: [
      ReviewsService,
      { provide: 'SQL', useValue: sql },
      { provide: 'OPENAI', useValue: openaiMock },
      { provide: AppConfigService, useValue: configMock },
      {
        provide: getLoggerToken(ReviewsService.name),
        useValue: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), trace: jest.fn() },
      },
    ],
  }).compile();
  return module.get<ReviewsService>(ReviewsService);
}

const FAKE_REVIEW: Record<string, unknown> = {
  review_text: 'Great food!',
  rating: 5,
  reviewer_name: 'Alice',
  restaurant_id: 'rest-1',
};

const FAKE_RESTAURANT: Record<string, unknown> = {
  name: 'Pasta Place',
  additional_info: 'Family friendly',
};

const FAKE_RESPONSES = {
  empathetic: 'We really appreciate your kind words!',
  professional: 'Thank you for your valuable feedback.',
  casual: 'Awesome, glad you enjoyed it!',
};

function mockOpenAiResponse(): void {
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

describe('ReviewsService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('generateResponses', () => {
    it('throws NotFoundException when the review does not exist', async () => {
      const service = await buildService(makeSql([]));

      await expect(service.generateResponses('nonexistent-id', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    // sql call order: review, subscription ([] = no sub), restaurant, INSERT
    it('returns generated responses and persists them to the database', async () => {
      const service = await buildService(
        makeSql([FAKE_REVIEW], [], [FAKE_RESTAURANT], []),
      );
      mockOpenAiResponse();

      const result = await service.generateResponses('review-1', 'user-1');

      expect(result.responses).toEqual(FAKE_RESPONSES);
      expect(result.generated_at).toBeInstanceOf(Date);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gpt-4o' }),
      );
    });

    it('includes additionalContext in the prompt when provided', async () => {
      const service = await buildService(
        makeSql([FAKE_REVIEW], [], [FAKE_RESTAURANT], []),
      );
      mockOpenAiResponse();

      await service.generateResponses('review-1', 'user-1', 'Customer is a VIP');

      const prompt = mockCreate.mock.calls[0][0].messages[0].content;
      expect(prompt).toContain('Customer is a VIP');
    });

    it('omits additionalContext block when not provided', async () => {
      const service = await buildService(
        makeSql([FAKE_REVIEW], [], [FAKE_RESTAURANT], []),
      );
      mockOpenAiResponse();

      await service.generateResponses('review-1', 'user-1');

      const prompt = mockCreate.mock.calls[0][0].messages[0].content;
      expect(prompt).not.toContain('Additional context');
    });

    it('includes restaurant additional_info in the prompt when present', async () => {
      const service = await buildService(
        makeSql([FAKE_REVIEW], [], [FAKE_RESTAURANT], []),
      );
      mockOpenAiResponse();

      await service.generateResponses('review-1', 'user-1');

      const prompt = mockCreate.mock.calls[0][0].messages[0].content;
      expect(prompt).toContain('Family friendly');
    });

    it('omits restaurant additional_info block when null', async () => {
      const service = await buildService(
        makeSql(
          [FAKE_REVIEW],
          [],
          [{ ...FAKE_RESTAURANT, additional_info: null }],
          [],
        ),
      );
      mockOpenAiResponse();

      await service.generateResponses('review-1', 'user-1');

      const prompt = mockCreate.mock.calls[0][0].messages[0].content;
      expect(prompt).not.toContain('About restaurant');
    });

    it('throws 429 when monthly limit is reached', async () => {
      const sub = {
        reviews_limit: 30,
        current_period_end: new Date(Date.now() + 86_400_000),
        period: 'month',
      };
      // sql: review, subscription, usage count (= limit)
      const service = await buildService(
        makeSql([FAKE_REVIEW], [sub], [{ count: '30' }]),
      );

      const err = await service.generateResponses('review-1', 'user-1').catch((e) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    });

    it('allows generation when usage is below the limit', async () => {
      const sub = {
        reviews_limit: 30,
        current_period_end: new Date(Date.now() + 86_400_000),
        period: 'month',
      };
      // sql: review, subscription, usage count (below limit), restaurant, INSERT
      const service = await buildService(
        makeSql([FAKE_REVIEW], [sub], [{ count: '5' }], [FAKE_RESTAURANT], []),
      );
      mockOpenAiResponse();

      const result = await service.generateResponses('review-1', 'user-1');
      expect(result.responses).toEqual(FAKE_RESPONSES);
    });

    it('skips limit check when user has no subscription', async () => {
      // sql: review, subscription (none), restaurant, INSERT
      const service = await buildService(
        makeSql([FAKE_REVIEW], [], [FAKE_RESTAURANT], []),
      );
      mockOpenAiResponse();

      const result = await service.generateResponses('review-1', 'user-1');
      expect(result.responses).toEqual(FAKE_RESPONSES);
    });
  });

  describe('replyToReview', () => {
    it('throws NotFoundException when the review does not exist', async () => {
      const service = await buildService(makeSql([]));

      await expect(
        service.replyToReview('nonexistent-id', 'user-1', 'Thanks!'),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates DB and returns success', async () => {
      const sql = makeSql([{ id: 'review-abc' }], []);
      const service = await buildService(sql);

      const result = await service.replyToReview('review-1', 'user-1', 'Thank you!');

      expect(sql).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
      expect(result.replied_at).toBeInstanceOf(Date);
    });
  });
});
