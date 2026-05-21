import { Test } from '@nestjs/testing';
import { RestaurantsService } from './restaurants.service';
import { AppConfigService } from 'src/config/config.service';
import { RestaurantChanges } from './restaurants.types';
import { getLoggerToken } from 'nestjs-pino';

describe('RestaurantsService', () => {
  let service: RestaurantsService;
  let sql: jest.Mock;

  const configMock = {
    get: jest.fn((key: string) => {
      if (key === 'google') return { places: { apiKey: 'fake-key' } };
    }),
  };

  beforeEach(async () => {
    sql = jest.fn();

    const module = await Test.createTestingModule({
      providers: [
        RestaurantsService,
        { provide: 'SQL', useValue: sql },
        { provide: AppConfigService, useValue: configMock },
        {
          provide: getLoggerToken(RestaurantsService.name),
          useValue: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), trace: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(RestaurantsService);

    jest.clearAllMocks();
    (global.fetch as jest.Mock) = jest.fn();
  });

  describe('getRestaurants', () => {
    it('should return restaurants from DB', async () => {
      sql.mockResolvedValueOnce([{ id: '1', name: 'My Place' }]);

      const result = await service.getRestaurants('u1');

      expect(sql).toHaveBeenCalledTimes(1);
      expect(result.restaurants.length).toBe(1);
    });

    it('should return empty list when user has no restaurants', async () => {
      sql.mockResolvedValueOnce([]);

      const result = await service.getRestaurants('u1');

      expect(result.restaurants).toEqual([]);
    });
  });

  describe('createRestaurant', () => {
    it('should insert a restaurant and return it', async () => {
      sql.mockResolvedValueOnce([{ id: 'new-id', name: 'My Place', slug: 'my-place', address: 'Street 1' }]);

      const result = await service.createRestaurant('u1', 'place-id-1', 'My Place', 'Street 1');

      expect(sql).toHaveBeenCalledTimes(1);
      expect(result.name).toBe('My Place');
    });
  });

  describe('updateRestaurantInfo', () => {
    it('should update restaurant info', async () => {
      sql.mockResolvedValueOnce([]);

      await service.updateRestaurantInfo('1', 'user-1', {
        ownerName: 'John',
        additionalInfo: 'Info',
      } as RestaurantChanges);

      expect(sql).toHaveBeenCalled();
    });
  });

  describe('getAutoReply', () => {
    it('should return auto reply', async () => {
      sql.mockResolvedValueOnce([
        {
          auto_reply_enabled: true,
          auto_reply_default_tone: 'friendly',
          auto_reply_custom_instructions: 'test',
        },
      ]);

      const result = await service.getAutoReply('1', 'user-1');

      expect(result).not.toBeNull();
    });

    it('should return null if not found', async () => {
      sql.mockResolvedValueOnce([]);

      const result = await service.getAutoReply('1', 'user-1');

      expect(result).toBeNull();
    });
  });

  describe('updateAutoReply', () => {
    it('should update auto reply', async () => {
      sql.mockResolvedValueOnce([]);

      await service.updateAutoReply('1', 'user-1', {
        enabled: true,
        defaultTone: 'friendly',
        customInstructions: 'test',
      });

      expect(sql).toHaveBeenCalled();
    });
  });

  describe('searchRestaurants', () => {
    it('should return mapped restaurants', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          results: [
            {
              name: 'Pizza Place',
              formatted_address: 'Street 1',
              rating: 4.5,
              user_ratings_total: 100,
              place_id: 'p1',
            },
          ],
        }),
      });

      const result = await service.searchRestaurants('pizza');

      expect(global.fetch).toHaveBeenCalled();
      expect(result.results[0].slug).toBe('pizza-place');
    });
  });
});
