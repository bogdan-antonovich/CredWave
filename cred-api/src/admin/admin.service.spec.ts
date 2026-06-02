import { Test } from '@nestjs/testing';
import { AdminService } from './admin.service';
import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { getLoggerToken } from 'nestjs-pino';
import { AiService } from '../shared/ai.service';

const mockAiService = {
  generateReviewResponses: jest.fn(),
};

const FAKE_RESPONSES = {
  empathetic: 'We appreciate it!',
  professional: 'Thank you.',
  casual: 'Awesome!',
};

describe('AdminService', () => {
  let service: AdminService;
  let sql: jest.Mock;

  beforeEach(async () => {
    sql = jest.fn();
    jest.resetAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: 'SQL', useValue: sql },
        { provide: AiService, useValue: mockAiService },
        { provide: getLoggerToken(AdminService.name), useValue: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), trace: jest.fn() } },
      ],
    }).compile();

    service = module.get(AdminService);
  });

  describe('generateResponses', () => {
    it('delegates to aiService and returns the result', async () => {
      mockAiService.generateReviewResponses.mockResolvedValueOnce(FAKE_RESPONSES);

      const result = await service.generateResponses({
        restaurantName: 'Pasta Place',
        reviewerName: 'Alice',
        reviewText: 'Great food!',
        rating: 5,
      });

      expect(mockAiService.generateReviewResponses).toHaveBeenCalledWith(
        'Pasta Place',
        'Alice',
        5,
        'Great food!',
      );
      expect(result).toEqual(FAKE_RESPONSES);
    });
  });

  describe('getRestaurants', () => {
    it('returns list of restaurants with name and slug', async () => {
      sql.mockResolvedValueOnce([
        { name: 'Bella Napoli', slug: 'bella-napoli' },
        { name: 'Sakura', slug: 'sakura' },
      ]);

      const result = await service.getRestaurants();

      expect(result).toEqual({
        restaurants: [
          { name: 'Bella Napoli', slug: 'bella-napoli' },
          { name: 'Sakura', slug: 'sakura' },
        ],
      });
    });

    it('returns empty list when no restaurants', async () => {
      sql.mockResolvedValueOnce([]);

      const result = await service.getRestaurants();

      expect(result).toEqual({ restaurants: [] });
    });
  });

  describe('addRestaurant', () => {
    it('returns id on success', async () => {
      sql.mockResolvedValueOnce([{ id: 1 }]);

      const result = await service.addRestaurant({
        name: 'Bella',
        slug: 'bella',
      });

      expect(result).toEqual({ id: 1 });
    });

    it('throws if insert fails', async () => {
      sql.mockResolvedValueOnce([]);

      await expect(
        service.addRestaurant({
          name: 'Bella',
          slug: 'bella',
        }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getBlocks', () => {
    it('throws NotFoundException when restaurant missing', async () => {
      sql.mockResolvedValueOnce([]);

      await expect(service.getBlocks('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns reviews with responses', async () => {
      // restaurant
      sql.mockResolvedValueOnce([{ id: 1, name: 'Bella' }]);

      // reviews
      sql.mockResolvedValueOnce([
        {
          id: 10,
          reviewer_name: 'Maria',
          review_text: 'Great!',
          rating: 5,
        },
      ]);

      // responses (for first review)
      sql.mockResolvedValueOnce([{ text: 'Thanks!', tone: 'friendly' }]);

      const result = await service.getBlocks('bella');

      expect(result).toEqual({
        blocks: [
          {
            id: 10,
            restaurant_name: 'Bella',
            reviewer_name: 'Maria',
            review_text: 'Great!',
            rating: 5,
            responses: [{ text: 'Thanks!', tone: 'friendly' }],
          },
        ],
      });
    });
  });

  describe('deleteBlock', () => {
    it('deletes review by id', async () => {
      sql.mockResolvedValueOnce([]);

      await service.deleteBlock(10);

      expect(sql).toHaveBeenCalledTimes(1);
      expect(sql).toHaveBeenCalledWith(expect.anything(), 10);
    });
  });

  describe('createPromoCode', () => {
    it('inserts the promo code', async () => {
      sql.mockResolvedValueOnce([]);

      await service.createPromoCode({ code: 'LAUNCH20', durationDays: 30 });

      expect(sql).toHaveBeenCalledTimes(1);
    });

    it('inserts with optional fields when provided', async () => {
      sql.mockResolvedValueOnce([]);

      await service.createPromoCode({
        code: 'SUMMER',
        durationDays: 14,
        maxUses: 100,
        expiresAt: '2026-12-31T00:00:00.000Z',
      });

      expect(sql).toHaveBeenCalledTimes(1);
    });
  });

  describe('getPromoCodes', () => {
    it('returns mapped promo codes in camelCase', async () => {
      sql.mockResolvedValueOnce([
        {
          code: 'LAUNCH20',
          duration_days: 30,
          max_uses: null,
          use_count: 5,
          expires_at: null,
          is_active: true,
          created_at: new Date('2026-01-01'),
        },
      ]);

      const result = await service.getPromoCodes();

      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('LAUNCH20');
      expect(result[0].durationDays).toBe(30);
      expect(result[0].useCount).toBe(5);
      expect(result[0].isActive).toBe(true);
    });

    it('returns empty array when no codes exist', async () => {
      sql.mockResolvedValueOnce([]);

      const result = await service.getPromoCodes();

      expect(result).toEqual([]);
    });
  });

  describe('updatePromoCode', () => {
    it('updates mutable fields', async () => {
      sql.mockResolvedValueOnce([]);

      await service.updatePromoCode('LAUNCH20', {
        durationDays: 60,
        maxUses: 200,
        isActive: false,
      });

      expect(sql).toHaveBeenCalledTimes(1);
    });
  });

  describe('deletePromoCode', () => {
    function setupBegin(tx: jest.Mock) {
      (sql as any).begin = jest.fn((cb: (tx: jest.Mock) => Promise<void>) =>
        cb(tx),
      );
    }

    it('runs inside a transaction', async () => {
      const tx = jest.fn()
        .mockResolvedValueOnce([]) // SELECT users with this promo_code (none)
        .mockResolvedValueOnce(undefined); // DELETE promo_code
      setupBegin(tx);

      await service.deletePromoCode('LAUNCH20');

      expect((sql as any).begin).toHaveBeenCalledTimes(1);
    });

    it('nulls promo_code on users before deleting', async () => {
      const tx = jest.fn()
        .mockResolvedValueOnce([{ id: 10 }, { id: 11 }]) // two users have this code
        .mockResolvedValueOnce(undefined) // UPDATE user 10
        .mockResolvedValueOnce(undefined) // UPDATE user 11
        .mockResolvedValueOnce(undefined); // DELETE promo_code
      setupBegin(tx);

      await service.deletePromoCode('LAUNCH20');

      expect(tx).toHaveBeenCalledTimes(4);
    });

    it('deletes the promo code even when no users have redeemed it', async () => {
      const tx = jest.fn()
        .mockResolvedValueOnce([]) // no users
        .mockResolvedValueOnce(undefined); // DELETE promo_code
      setupBegin(tx);

      await service.deletePromoCode('LAUNCH20');

      expect(tx).toHaveBeenCalledTimes(2);
    });
  });

  describe('deleteRestaurant', () => {
    it('deletes restaurant by slug flow', async () => {
      const txMock = jest.fn();

      (sql as any).begin = jest.fn((cb: (tx: jest.Mock) => Promise<void>) =>
        cb(txMock),
      );

      txMock
        .mockResolvedValueOnce([{ id: 1 }]) // select restaurant
        .mockResolvedValueOnce(undefined); // delete

      await service.deleteRestaurant('bella');

      expect((sql as any).begin).toHaveBeenCalled();
    });
  });
});
