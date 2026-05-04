import { Test } from '@nestjs/testing';
import { AdminService } from './admin.service';
import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

describe('AdminService', () => {
  let service: AdminService;
  let sql: jest.Mock;

  beforeEach(async () => {
    sql = jest.fn();

    const module = await Test.createTestingModule({
      providers: [AdminService, { provide: 'SQL', useValue: sql }],
    }).compile();

    service = module.get(AdminService);
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
