import { Test } from '@nestjs/testing';
import { NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { AiService } from '../shared/ai.service';
import { getLoggerToken } from 'nestjs-pino';

type SqlMock = jest.Mock<
  Promise<unknown[]>,
  [TemplateStringsArray, ...unknown[]]
>;

const FAKE_RESPONSES = {
  empathetic: 'We really appreciate your kind words!',
  professional: 'Thank you for your valuable feedback.',
  casual: 'Awesome, glad you enjoyed it!',
};

const mockAiService = {
  generateReviewResponses: jest.fn<Promise<typeof FAKE_RESPONSES>, unknown[]>(),
};

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

function makeSql(...rowSets: Record<string, unknown>[][]): SqlMock {
  let callIndex = 0;
  return jest
    .fn<Promise<unknown[]>, [TemplateStringsArray, ...unknown[]]>()
    .mockImplementation(() => Promise.resolve(rowSets[callIndex++] ?? []));
}

async function buildService(sql: SqlMock): Promise<ReviewsService> {
  (sql as any).json = jest.fn((x: unknown) => x);
  (sql as any).unsafe = jest.fn((x: unknown) => x);
  const module = await Test.createTestingModule({
    providers: [
      ReviewsService,
      { provide: 'SQL', useValue: sql },
      { provide: AiService, useValue: mockAiService },
      {
        provide: getLoggerToken(ReviewsService.name),
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
  return module.get<ReviewsService>(ReviewsService);
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
      const sql = makeSql([FAKE_REVIEW], [], [FAKE_RESTAURANT], []);
      mockAiService.generateReviewResponses.mockResolvedValueOnce(FAKE_RESPONSES);
      const service = await buildService(sql);

      const result = await service.generateResponses('review-1', 'user-1');

      expect(result.responses).toEqual(FAKE_RESPONSES);
      expect(result.generated_at).toBeInstanceOf(Date);
      expect(mockAiService.generateReviewResponses).toHaveBeenCalledWith(
        FAKE_RESTAURANT.name,
        FAKE_REVIEW.reviewer_name,
        FAKE_REVIEW.rating,
        FAKE_REVIEW.review_text,
        FAKE_RESTAURANT.additional_info,
        undefined,
      );
    });

    it('passes additionalContext to aiService when provided', async () => {
      mockAiService.generateReviewResponses.mockResolvedValueOnce(FAKE_RESPONSES);
      const service = await buildService(makeSql([FAKE_REVIEW], [], [FAKE_RESTAURANT], []));

      await service.generateResponses('review-1', 'user-1', 'Customer is a VIP');

      expect(mockAiService.generateReviewResponses).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        'Customer is a VIP',
      );
    });

    it('passes null additional_info to aiService when restaurant has none', async () => {
      mockAiService.generateReviewResponses.mockResolvedValueOnce(FAKE_RESPONSES);
      const service = await buildService(
        makeSql([FAKE_REVIEW], [], [{ ...FAKE_RESTAURANT, additional_info: null }], []),
      );

      await service.generateResponses('review-1', 'user-1');

      expect(mockAiService.generateReviewResponses).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        null,
        undefined,
      );
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
      mockAiService.generateReviewResponses.mockResolvedValueOnce(FAKE_RESPONSES);
      // sql: review, subscription, usage count (below limit), restaurant, INSERT
      const service = await buildService(
        makeSql([FAKE_REVIEW], [sub], [{ count: '5' }], [FAKE_RESTAURANT], []),
      );

      const result = await service.generateResponses('review-1', 'user-1');
      expect(result.responses).toEqual(FAKE_RESPONSES);
    });

    it('skips limit check when user has no subscription', async () => {
      mockAiService.generateReviewResponses.mockResolvedValueOnce(FAKE_RESPONSES);
      // sql: review, subscription (none), restaurant, INSERT
      const service = await buildService(
        makeSql([FAKE_REVIEW], [], [FAKE_RESTAURANT], []),
      );

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
