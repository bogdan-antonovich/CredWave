import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { AppConfigService } from 'src/config/config.service';
import { getLoggerToken } from 'nestjs-pino';
import { google } from 'googleapis';
import type { AuthPlus } from 'googleapis-common';
import type { Credentials } from 'google-auth-library';
import type { GaxiosOptions, GaxiosResponse } from 'gaxios';
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

const mockAuthRequest = jest.fn<
  Promise<GaxiosResponse<unknown>>,
  [GaxiosOptions]
>();

const mockSetCredentials = jest.fn<void, [Credentials]>();

jest.mock('googleapis', () => ({
  google: { auth: { OAuth2: jest.fn() } },
}));

const mockedAuth = google.auth as jest.Mocked<AuthPlus>;

function makeSql(...rowSets: Record<string, unknown>[][]): SqlMock {
  let callIndex = 0;
  return jest
    .fn<Promise<unknown[]>, [TemplateStringsArray, ...unknown[]]>()
    .mockImplementation(() => Promise.resolve(rowSets[callIndex++] ?? []));
}

async function buildService(sql: SqlMock): Promise<ReviewsService> {
  (sql as any).json = jest.fn((x: unknown) => x);
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
      { provide: getLoggerToken(ReviewsService.name), useValue: { debug: jest.fn() } },
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

const FAKE_RESTAURANT_WITH_OAUTH: Record<string, unknown> = {
  user_id: 'user-1',
  google_account_id: 'accounts/123',
  google_location_id: 'locations/456',
};

const FAKE_ACCESS_TOKEN = 'ya29.fake-token';

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

function mockGoogleApiSuccess(): void {
  mockAuthRequest.mockResolvedValueOnce({
    data: {},
    status: 200,
  } as GaxiosResponse<unknown>);
}

describe('ReviewsService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(mockedAuth, 'OAuth2').mockImplementation(
      () =>
        ({
          setCredentials: mockSetCredentials,
          request: mockAuthRequest,
        }) as unknown as InstanceType<typeof mockedAuth.OAuth2>,
    );
  });

  describe('generateResponses', () => {
    it('throws NotFoundException when the review does not exist', async () => {
      const service = await buildService(makeSql([]));

      await expect(service.generateResponses('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns generated responses and persists them to the database', async () => {
      const service = await buildService(
        makeSql([FAKE_REVIEW], [FAKE_RESTAURANT], []),
      );
      mockOpenAiResponse();

      const result = await service.generateResponses('review-1');

      expect(result.responses).toEqual(FAKE_RESPONSES);
      expect(result.generated_at).toBeInstanceOf(Date);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gpt-4o' }),
      );
    });

    it('includes additionalContext in the prompt when provided', async () => {
      const service = await buildService(
        makeSql([FAKE_REVIEW], [FAKE_RESTAURANT], []),
      );
      mockOpenAiResponse();

      await service.generateResponses('review-1', 'Customer is a VIP');

      const prompt = mockCreate.mock.calls[0][0].messages[0].content;
      expect(prompt).toContain('Customer is a VIP');
    });

    it('omits additionalContext block when not provided', async () => {
      const service = await buildService(
        makeSql([FAKE_REVIEW], [FAKE_RESTAURANT], []),
      );
      mockOpenAiResponse();

      await service.generateResponses('review-1');

      const prompt = mockCreate.mock.calls[0][0].messages[0].content;
      expect(prompt).not.toContain('Additional context');
    });

    it('includes restaurant additional_info in the prompt when present', async () => {
      const service = await buildService(
        makeSql([FAKE_REVIEW], [FAKE_RESTAURANT], []),
      );
      mockOpenAiResponse();

      await service.generateResponses('review-1');

      const prompt = mockCreate.mock.calls[0][0].messages[0].content;
      expect(prompt).toContain('Family friendly');
    });

    it('omits restaurant additional_info block when null', async () => {
      const service = await buildService(
        makeSql(
          [FAKE_REVIEW],
          [{ ...FAKE_RESTAURANT, additional_info: null }],
          [],
        ),
      );
      mockOpenAiResponse();

      await service.generateResponses('review-1');

      const prompt = mockCreate.mock.calls[0][0].messages[0].content;
      expect(prompt).not.toContain('About restaurant');
    });
  });

  describe('replyToReview', () => {
    const reviewRow: Record<string, unknown> = {
      google_review_id: 'review-abc',
      restaurant_id: 'rest-1',
    };

    it('throws NotFoundException when the review does not exist', async () => {
      const service = await buildService(makeSql([]));

      await expect(
        service.replyToReview('nonexistent-id', 'Thanks!'),
      ).rejects.toThrow(NotFoundException);
    });

    it('calls the Google My Business API with the correct URL and body', async () => {
      const service = await buildService(
        makeSql(
          [reviewRow],
          [FAKE_RESTAURANT_WITH_OAUTH],
          [{ token: FAKE_ACCESS_TOKEN }],
          [],
        ),
      );
      mockGoogleApiSuccess();

      const result = await service.replyToReview('review-1', 'Thank you!');

      expect(mockSetCredentials).toHaveBeenCalledWith({
        access_token: FAKE_ACCESS_TOKEN,
      });
      expect(mockAuthRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ comment: 'Thank you!' }),
          url: expect.stringContaining('review-abc/reply') as string,
        }),
      );
      expect(result.success).toBe(true);
      expect(result.replied_at).toBeInstanceOf(Date);
    });

    it('persists reply text and replied flag after a successful API call', async () => {
      const sql = makeSql(
        [reviewRow],
        [FAKE_RESTAURANT_WITH_OAUTH],
        [{ token: FAKE_ACCESS_TOKEN }],
        [],
      );
      const service = await buildService(sql);
      mockGoogleApiSuccess();

      await service.replyToReview('review-1', 'Thank you!');

      const lastCall = sql.mock.calls[sql.mock.calls.length - 1];
      expect(lastCall).toContain('Thank you!');
    });

    it('does not persist a reply when the Google API call throws', async () => {
      const sql = makeSql(
        [reviewRow],
        [FAKE_RESTAURANT_WITH_OAUTH],
        [{ token: FAKE_ACCESS_TOKEN }],
      );
      const service = await buildService(sql);
      mockAuthRequest.mockRejectedValueOnce(new Error('401 Unauthorized'));

      await expect(
        service.replyToReview('review-1', 'Thank you!'),
      ).rejects.toThrow('401 Unauthorized');

      expect(sql).toHaveBeenCalledTimes(3);
    });

    it('passes null to setCredentials when no access token row exists', async () => {
      const service = await buildService(
        makeSql([reviewRow], [FAKE_RESTAURANT_WITH_OAUTH], [], []),
      );
      mockGoogleApiSuccess();

      await service.replyToReview('review-1', 'Thanks!');

      expect(mockSetCredentials).toHaveBeenCalledWith({ access_token: null });
    });
  });
});
