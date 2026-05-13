import { Test } from '@nestjs/testing';
import { ReviewsService } from './reviews.service';
import { AppConfigService } from 'src/config/config.service';
import { GoogleTokensService } from '../../auth/auth.service';
import { EmailService } from '../../email/email.serivice';
import { NotFoundException } from '@nestjs/common';
import { google } from 'googleapis';
import { getJson } from 'serpapi';
import { SerpReview } from './reviews.types';
import { getLoggerToken } from 'nestjs-pino';

const mockEmailService = {
  sendNewReview: jest.fn(),
  sendAutoReply: jest.fn(),
};

jest.mock('googleapis', () => ({
  google: { auth: { OAuth2: jest.fn() } },
}));

jest.mock('serpapi', () => ({
  getJson: jest.fn(),
}));

describe('ReviewsService', () => {
  let service: ReviewsService;
  let sql: jest.Mock;
  let mockGoogleTokens: { withAutoRefresh: jest.Mock };

  const configMock = {
    get: jest.fn((key: string) => {
      if (key === 'serpapi') return { apiKey: 'fake-key' };
      if (key === 'openai') return { model: 'gpt-4o' };
      return null;
    }),
  };

  const OAuth2Mock = google.auth.OAuth2 as unknown as jest.Mock;

  beforeEach(async () => {
    sql = jest.fn();
    (sql as any).json = jest.fn((x: unknown) => x);

    mockGoogleTokens = {
      withAutoRefresh: jest.fn().mockImplementation(
        (_: string, fn: (token: string) => Promise<unknown>) => fn('TOKEN123'),
      ),
    };

    const module = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: 'SQL', useValue: sql },
        { provide: 'OPENAI', useValue: { chat: { completions: { create: jest.fn() } } } },
        { provide: AppConfigService, useValue: configMock },
        { provide: GoogleTokensService, useValue: mockGoogleTokens },
        { provide: EmailService, useValue: mockEmailService },
        {
          provide: getLoggerToken(ReviewsService.name),
          useValue: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), trace: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);

    jest.clearAllMocks();
    OAuth2Mock.mockReset();
  });

  describe('syncReviews token delegation', () => {
    it('should call withAutoRefresh with the restaurant user_id', async () => {
      const mockRequest = jest.fn().mockResolvedValue({ data: { reviews: [] } });
      OAuth2Mock.mockImplementation(() => ({
        setCredentials: jest.fn(),
        request: mockRequest,
      }));

      sql
        .mockResolvedValueOnce([{ user_id: 'u1', google_account_id: 'acc', google_location_id: 'loc' }])
        .mockResolvedValueOnce([]);

      mockGoogleTokens.withAutoRefresh.mockImplementation(
        (_: string, fn: (token: string) => Promise<unknown>) => fn('TOKEN123'),
      );

      await service.syncReviews('r1');

      expect(mockGoogleTokens.withAutoRefresh).toHaveBeenCalledWith('u1', expect.any(Function));
    });

    it('should pass the token from withAutoRefresh to OAuth2 setCredentials', async () => {
      const setCredentialsMock = jest.fn();
      const requestMock = jest.fn().mockResolvedValue({ data: { reviews: [] } });
      OAuth2Mock.mockImplementation(() => ({
        setCredentials: setCredentialsMock,
        request: requestMock,
      }));

      sql
        .mockResolvedValueOnce([{ user_id: 'u1', google_account_id: 'acc', google_location_id: 'loc' }])
        .mockResolvedValueOnce([]);

      mockGoogleTokens.withAutoRefresh.mockImplementation(
        (_: string, fn: (token: string) => Promise<unknown>) => fn('MY_TOKEN'),
      );

      await service.syncReviews('r1');

      expect(setCredentialsMock).toHaveBeenCalledWith({ access_token: 'MY_TOKEN' });
    });
  });

  describe('syncReviews', () => {
    it('should throw NotFoundException if restaurantId is invalid', async () => {
      sql.mockResolvedValueOnce([]);

      await expect(service.syncReviews('bad-id')).rejects.toThrow(NotFoundException);
    });

    it('should sync reviews with google and insert new ones', async () => {
      const mockRequest = jest.fn().mockResolvedValue({
        data: {
          reviews: [
            {
              reviewId: 'r1',
              starRating: 'FIVE',
              comment: 'Great',
              createTime: '2024-01-01',
              reviewer: { displayName: 'John', profilePhotoUrl: 'url' },
            },
          ],
        },
      });

      OAuth2Mock.mockImplementation(() => ({
        setCredentials: jest.fn(),
        request: mockRequest,
      }));

      sql
        .mockResolvedValueOnce([{ user_id: 'u1', google_account_id: 'acc', google_location_id: 'loc' }])
        .mockResolvedValueOnce([{ inserted: true }])
        .mockResolvedValueOnce([]);

      const result = await service.syncReviews('r1');

      expect(result.new_reviews).toBe(1);
      expect(mockRequest).toHaveBeenCalled();
      expect(sql).toHaveBeenCalledTimes(3);
    });

    it('should handle update (not inserted)', async () => {
      const mockRequest = jest.fn().mockResolvedValue({
        data: {
          reviews: [{ reviewId: 'r1', starRating: 'FIVE', createTime: '2024-01-01' }],
        },
      });

      OAuth2Mock.mockImplementation(() => ({
        setCredentials: jest.fn(),
        request: mockRequest,
      }));

      sql
        .mockResolvedValueOnce([{ user_id: 'u1', google_account_id: 'acc', google_location_id: 'loc' }])
        .mockResolvedValueOnce([{ inserted: false }])
        .mockResolvedValueOnce([]);

      const result = await service.syncReviews('r1');

      expect(result.new_reviews).toBe(0);
    });

    it('posts an auto-reply to Google when auto_reply_enabled is true', async () => {
      const openaiCreate = (service as any).openai.chat.completions.create as jest.Mock;
      openaiCreate.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify({
              empathetic: 'We appreciate your feedback!',
              professional: 'Thank you for your review.',
              casual: 'Thanks for visiting!',
            }),
          },
        }],
      });

      const mockRequest = jest.fn()
        .mockResolvedValueOnce({
          data: {
            reviews: [{
              reviewId: 'r1',
              starRating: 'THREE',
              comment: 'It was okay',
              createTime: '2024-01-01',
              reviewer: { displayName: 'Bob', profilePhotoUrl: '' },
            }],
          },
        })
        .mockResolvedValueOnce({ data: {} }); // auto-reply PUT response

      OAuth2Mock.mockImplementation(() => ({
        setCredentials: jest.fn(),
        request: mockRequest,
      }));

      sql
        .mockResolvedValueOnce([{
          user_id: 'u1',
          google_account_id: 'acc',
          google_location_id: 'loc',
          name: 'Pasta Place',
          last_synced_at: new Date(),
          auto_reply_enabled: true,
          auto_reply_default_tone: 'professional',
        }])
        .mockResolvedValueOnce([{ inserted: true }])       // INSERT review
        .mockResolvedValueOnce([{ email: 'u@test.com', name: 'Alice' }]) // SELECT user
        .mockResolvedValueOnce([])                          // UPDATE reviews SET replied
        .mockResolvedValueOnce([]);                         // UPDATE restaurants SET last_synced_at

      const result = await service.syncReviews('r1');

      expect(result.new_reviews).toBe(1);
      expect(mockRequest).toHaveBeenCalledTimes(2);
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ comment: 'Thank you for your review.' }),
        }),
      );
      expect(mockEmailService.sendAutoReply).toHaveBeenCalledWith(
        'u@test.com',
        'Alice',
        'Pasta Place',
        'Bob',
        3,
      );
    });

    it('does not auto-reply when auto_reply_enabled is false', async () => {
      const mockRequest = jest.fn().mockResolvedValue({ data: { reviews: [] } });
      OAuth2Mock.mockImplementation(() => ({
        setCredentials: jest.fn(),
        request: mockRequest,
      }));

      sql
        .mockResolvedValueOnce([{
          user_id: 'u1',
          google_account_id: 'acc',
          google_location_id: 'loc',
          name: 'Pasta Place',
          last_synced_at: new Date(),
          auto_reply_enabled: false,
        }])
        .mockResolvedValueOnce([]); // UPDATE restaurants SET last_synced_at

      await service.syncReviews('r1');

      expect(mockRequest).toHaveBeenCalledTimes(1);
      expect(mockEmailService.sendAutoReply).not.toHaveBeenCalled();
    });

    it('logs an error and continues sync if auto-reply fails', async () => {
      const openaiCreate = (service as any).openai.chat.completions.create as jest.Mock;
      openaiCreate.mockRejectedValueOnce(new Error('OpenAI error'));

      const mockRequest = jest.fn().mockResolvedValueOnce({
        data: {
          reviews: [{
            reviewId: 'r1',
            starRating: 'FOUR',
            comment: 'Nice',
            createTime: '2024-01-01',
            reviewer: { displayName: 'Carol', profilePhotoUrl: '' },
          }],
        },
      });

      OAuth2Mock.mockImplementation(() => ({
        setCredentials: jest.fn(),
        request: mockRequest,
      }));

      sql
        .mockResolvedValueOnce([{
          user_id: 'u1',
          google_account_id: 'acc',
          google_location_id: 'loc',
          name: 'Pasta Place',
          last_synced_at: new Date(),
          auto_reply_enabled: true,
          auto_reply_default_tone: 'casual',
        }])
        .mockResolvedValueOnce([{ inserted: true }])
        .mockResolvedValueOnce([{ email: 'u@test.com', name: 'Alice' }])
        .mockResolvedValueOnce([]); // UPDATE restaurants SET last_synced_at

      const result = await service.syncReviews('r1');

      expect(result.new_reviews).toBe(1);
      expect(mockEmailService.sendAutoReply).not.toHaveBeenCalled();
    });
  });

  describe('getReviews', () => {
    it('should throw if restaurant not found', async () => {
      sql.mockResolvedValueOnce([]);

      await expect(service.getReviews('bad', 'all', 1, 10)).rejects.toThrow(NotFoundException);
    });

    it('should trigger sync if stale', async () => {
      const syncSpy = jest
        .spyOn(service, 'syncReviews')
        .mockResolvedValue({ new_reviews: 0, synced_at: new Date() });

      sql
        .mockResolvedValueOnce([{ is_stale: true }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ pending: 0, replied: 0, total: 0 }]);

      await service.getReviews('r1', 'all', 1, 10);

      expect(syncSpy).toHaveBeenCalledWith('r1');
    });

    it('should return reviews with pagination and stats', async () => {
      sql
        .mockResolvedValueOnce([{ is_stale: false }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 1 }])
        .mockResolvedValueOnce([{ pending: 1, replied: 2, total: 3 }]);

      const result = await service.getReviews('r1', 'all', 1, 2);

      expect(result.reviews.length).toBe(1);
      expect(result.pagination.total).toBe(3);
      expect(result.stats.pending).toBe(1);
    });

    it('should filter pending reviews', async () => {
      sql
        .mockResolvedValueOnce([{ last_synced_at: new Date() }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 1 }])
        .mockResolvedValueOnce([{ pending: 2, replied: 1, total: 3 }]);

      const result = await service.getReviews('r1', 'pending', 1, 10);

      expect(result.pagination.total).toBe(2);
    });

    it('should filter replied reviews', async () => {
      sql
        .mockResolvedValueOnce([{ last_synced_at: new Date() }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 1 }])
        .mockResolvedValueOnce([{ pending: 2, replied: 1, total: 3 }]);

      const result = await service.getReviews('r1', 'replied', 1, 10);

      expect(result.pagination.total).toBe(1);
    });
  });

  describe('getDemoReviewsFromDb', () => {
    it('should return demo reviews from db', async () => {
      sql.mockResolvedValueOnce([{ reviews: [{ id: 1 }], blocks: null }]);

      const result = await service.getDemoReviewsFromDb('place1');

      expect(result).toEqual({ reviews: [{ id: 1 }], blocks: null });
    });

    it('should return null if no demo reviews found', async () => {
      sql.mockResolvedValueOnce([]);

      const result = await service.getDemoReviewsFromDb('place1');

      expect(result).toBeNull();
    });
  });

  describe('saveDemoReviews', () => {
    it('should save demo reviews to db', async () => {
      sql.mockResolvedValueOnce([]);

      await service.saveDemoReviews('place1', [makeSerpReview()]);

      expect(sql).toHaveBeenCalled();
    });
  });

  describe('getDemoReviews', () => {
    it('should return cached reviews if exist', async () => {
      const spy = jest
        .spyOn(service, 'getDemoReviewsFromDb')
        .mockResolvedValue({ reviews: [{ id: 1 } as any], blocks: null });

      const result = await service.getDemoReviews('place1');

      expect(spy).toHaveBeenCalled();
      expect(result.reviews.length).toBe(1);
      expect(getJson).not.toHaveBeenCalled();
    });

    it('should fetch, filter and cache reviews if not cached', async () => {
      jest.spyOn(service, 'getDemoReviewsFromDb').mockResolvedValue(null);
      const saveSpy = jest.spyOn(service, 'saveDemoReviews').mockResolvedValue();

      (getJson as jest.Mock).mockResolvedValue({
        reviews: [
          { rating: 1 },
          { rating: 2 },
          { rating: 5 },
          { rating: 4 },
          { rating: 3 },
        ],
      });

      const result = await service.getDemoReviews('place1');

      expect(getJson).toHaveBeenCalled();
      expect(saveSpy).toHaveBeenCalled();
      expect(result.reviews.length).toBeGreaterThan(0);
    });
  });
});

function makeSerpReview(overrides: Partial<SerpReview> = {}): SerpReview {
  return {
    rating: 5,
    snippet: 'Test',
    response: null,
    ...overrides,
  } as SerpReview;
}
