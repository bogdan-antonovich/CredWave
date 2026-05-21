import { Test } from '@nestjs/testing';
import { ReviewsService } from './reviews.service';
import { AppConfigService } from 'src/config/config.service';
import { EmailService } from '../../email/email.serivice';
import { NotFoundException } from '@nestjs/common';
import { getJson } from 'serpapi';
import { SerpReview } from './reviews.types';
import { getLoggerToken } from 'nestjs-pino';

const mockEmailService = {
  sendNewReview: jest.fn(),
};

const mockOutscraperClient = {
  googleMapsReviews: jest.fn(),
};

jest.mock('serpapi', () => ({
  getJson: jest.fn(),
}));

describe('ReviewsService', () => {
  let service: ReviewsService;
  let sql: jest.Mock;

  const configMock = {
    get: jest.fn((key: string) => {
      if (key === 'serpapi') return { apiKey: 'fake-key' };
      if (key === 'openai') return { model: 'gpt-4o' };
      return null;
    }),
  };

  const FAKE_OUTSCRAPER_REVIEW = {
    review_id: 'r1',
    author_title: 'John',
    author_image: null,
    review_text: 'Great food',
    review_rating: 5,
    review_datetime_utc: '2024-01-01 12:00:00',
    review_link: null,
    review_pagination_id: 'pag1',
    owner_answer: null,
  };

  beforeEach(async () => {
    sql = jest.fn();
    (sql as any).json = jest.fn((x: unknown) => x);

    const module = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: 'SQL', useValue: sql },
        {
          provide: 'OPENAI',
          useValue: { chat: { completions: { create: jest.fn() } } },
        },
        { provide: AppConfigService, useValue: configMock },
        { provide: EmailService, useValue: mockEmailService },
        { provide: 'OUTSCRAPER_CLIENT', useValue: mockOutscraperClient },
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

    service = module.get<ReviewsService>(ReviewsService);

    jest.clearAllMocks();
    mockOutscraperClient.googleMapsReviews.mockResolvedValue([[]]);
  });

  describe('syncReviews', () => {
    it('should throw NotFoundException if restaurant not found', async () => {
      sql.mockResolvedValueOnce([]);

      await expect(service.syncReviews('bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should sync reviews via Outscraper and insert new ones', async () => {
      sql
        .mockResolvedValueOnce([
          {
            user_id: 'u1',
            google_place_id: 'place1',
            name: 'Test',
            last_synced_at: null,
          },
        ])
        .mockResolvedValueOnce([]) // UPDATE place meta
        .mockResolvedValueOnce([{ inserted: true }])
        .mockResolvedValueOnce([]);

      mockOutscraperClient.googleMapsReviews.mockResolvedValueOnce([
        { reviews_data: [FAKE_OUTSCRAPER_REVIEW] },
      ]);

      const result = await service.syncReviews('r1');

      expect(result.new_reviews).toBe(1);
      expect(mockOutscraperClient.googleMapsReviews).toHaveBeenCalledWith(
        ['place1'],
        5,
        null,
        1,
        'newest',
        null,
        null,
        null,
        null,
        true,
      );
    });

    it('should count 0 new reviews for duplicate inserts', async () => {
      sql
        .mockResolvedValueOnce([
          {
            user_id: 'u1',
            google_place_id: 'place1',
            name: 'Test',
            last_synced_at: null,
          },
        ])
        .mockResolvedValueOnce([]) // UPDATE place meta
        .mockResolvedValueOnce([]) // ON CONFLICT DO NOTHING returns no row
        .mockResolvedValueOnce([]);

      mockOutscraperClient.googleMapsReviews.mockResolvedValueOnce([
        { reviews_data: [FAKE_OUTSCRAPER_REVIEW] },
      ]);

      const result = await service.syncReviews('r1');

      expect(result.new_reviews).toBe(0);
    });

    it('sends email notification for new review when not initial sync', async () => {
      const lastSync = new Date();
      sql
        .mockResolvedValueOnce([
          {
            user_id: 'u1',
            google_place_id: 'place1',
            name: 'Test',
            last_synced_at: lastSync,
          },
        ])
        .mockResolvedValueOnce([]) // UPDATE place meta
        .mockResolvedValueOnce([{ inserted: true }])
        .mockResolvedValueOnce([{ email: 'u@test.com', name: 'Alice' }])
        .mockResolvedValueOnce([]);

      mockOutscraperClient.googleMapsReviews.mockResolvedValueOnce([
        { reviews_data: [FAKE_OUTSCRAPER_REVIEW] },
      ]);

      await service.syncReviews('r1');

      expect(mockEmailService.sendNewReview).toHaveBeenCalledWith(
        'u@test.com',
        'Alice',
        'Test',
        'John',
        5,
        'Great food',
      );
    });

    it('does not send email on initial sync', async () => {
      sql
        .mockResolvedValueOnce([
          {
            user_id: 'u1',
            google_place_id: 'place1',
            name: 'Test',
            last_synced_at: null,
          },
        ])
        .mockResolvedValueOnce([]) // UPDATE place meta
        .mockResolvedValueOnce([{ inserted: true }])
        .mockResolvedValueOnce([]);

      mockOutscraperClient.googleMapsReviews.mockResolvedValueOnce([
        { reviews_data: [FAKE_OUTSCRAPER_REVIEW] },
      ]);

      await service.syncReviews('r1');

      expect(mockEmailService.sendNewReview).not.toHaveBeenCalled();
    });

    it('uses cutoff from last_synced_at for incremental sync', async () => {
      const lastSync = new Date('2024-06-01T00:00:00Z');
      sql
        .mockResolvedValueOnce([
          {
            user_id: 'u1',
            google_place_id: 'place1',
            name: 'Test',
            last_synced_at: lastSync,
          },
        ])
        .mockResolvedValueOnce([]) // UPDATE place meta
        .mockResolvedValueOnce([]);

      const result = await service.syncReviews('r1');

      expect(mockOutscraperClient.googleMapsReviews).toHaveBeenCalledWith(
        ['place1'],
        5,
        null,
        1,
        'newest',
        null,
        null,
        String(Math.floor(lastSync.getTime() / 1000)),
        null,
        true,
      );
      expect(result.new_reviews).toBe(0);
    });
  });

  describe('getReviews', () => {
    it('should throw if restaurant not found', async () => {
      sql.mockResolvedValueOnce([]);

      await expect(service.getReviews('bad', 'all', 1, 10)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should trigger sync if stale', async () => {
      const syncSpy = jest
        .spyOn(service, 'syncReviews')
        .mockResolvedValue({ new_reviews: 0, synced_at: new Date() });

      sql
        .mockResolvedValueOnce([{ is_stale: true, never_synced: true, google_place_id: 'place1' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ outscraper_pagination_id: null }])
        .mockResolvedValueOnce([]) // statusFilter fragment call
        .mockResolvedValueOnce([]) // reviews
        .mockResolvedValueOnce([{ pending: 0, replied: 0, total: 0 }]);

      await service.getReviews('r1', 'all', 1, 10);

      expect(syncSpy).toHaveBeenCalledWith('r1');
    });

    it('should return reviews with pagination and stats', async () => {
      sql
        .mockResolvedValueOnce([{ is_stale: false, never_synced: false, google_place_id: 'place1' }])
        .mockResolvedValueOnce([{ count: '5' }])
        .mockResolvedValueOnce([]) // statusFilter fragment call
        .mockResolvedValueOnce([{ id: 1 }])
        .mockResolvedValueOnce([{ pending: 1, replied: 2, total: 3 }]);

      const result = await service.getReviews('r1', 'all', 1, 2);

      expect(result.reviews.length).toBe(1);
      expect(result.pagination.total).toBe(3);
      expect(result.stats.pending).toBe(1);
    });

    it('should filter pending reviews', async () => {
      sql
        .mockResolvedValueOnce([{ is_stale: false, never_synced: false, google_place_id: 'place1' }])
        .mockResolvedValueOnce([{ count: '100' }])
        .mockResolvedValueOnce([]) // statusFilter fragment call
        .mockResolvedValueOnce([{ id: 1 }])
        .mockResolvedValueOnce([{ pending: 2, replied: 1, total: 3 }]);

      const result = await service.getReviews('r1', 'pending', 1, 10);

      expect(result.pagination.total).toBe(2);
    });

    it('should filter replied reviews', async () => {
      sql
        .mockResolvedValueOnce([{ is_stale: false, never_synced: false, google_place_id: 'place1' }])
        .mockResolvedValueOnce([{ count: '100' }])
        .mockResolvedValueOnce([]) // statusFilter fragment call
        .mockResolvedValueOnce([{ id: 1 }])
        .mockResolvedValueOnce([{ pending: 2, replied: 1, total: 3 }]);

      const result = await service.getReviews('r1', 'replied', 1, 10);

      expect(result.pagination.total).toBe(1);
    });

    it('fetches next page from Outscraper when db count is insufficient', async () => {
      sql
        .mockResolvedValueOnce([{ is_stale: false, never_synced: false, google_place_id: 'place1' }])
        .mockResolvedValueOnce([{ count: '3' }])
        .mockResolvedValueOnce([{ outscraper_pagination_id: 'cursor-abc' }])
        .mockResolvedValueOnce([]) // INSERT from outscraper
        .mockResolvedValueOnce([]) // statusFilter fragment call
        .mockResolvedValueOnce([{ id: 1 }, { id: 2 }, { id: 3 }])
        .mockResolvedValueOnce([{ pending: 3, replied: 0, total: 3 }]);

      mockOutscraperClient.googleMapsReviews.mockResolvedValueOnce([
        { reviews_data: [FAKE_OUTSCRAPER_REVIEW] },
      ]);

      await service.getReviews('r1', 'all', 1, 5);

      expect(mockOutscraperClient.googleMapsReviews).toHaveBeenCalledWith(
        ['place1'],
        5,
        null,
        1,
        'newest',
        'cursor-abc',
        null,
        null,
        null,
        true,
      );
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
      const saveSpy = jest
        .spyOn(service, 'saveDemoReviews')
        .mockResolvedValue();

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
