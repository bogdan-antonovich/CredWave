import { Test } from '@nestjs/testing';
import { RestaurantsService } from './restaurants.service';
import { AppConfigService } from 'src/config/config.service';
import { google } from 'googleapis';
import { RestaurantChanges } from './restaurants.types';

jest.mock('googleapis', () => ({
  google: {
    auth: { OAuth2: jest.fn() },
    mybusinessaccountmanagement: jest.fn(),
    mybusinessbusinessinformation: jest.fn(),
  },
}));

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
      ],
    }).compile();

    service = module.get(RestaurantsService);

    jest.clearAllMocks();
    (global.fetch as jest.Mock) = jest.fn();
  });

  describe('getBusinessLocations', () => {
    it('should throw if no token', async () => {
      sql.mockResolvedValueOnce([]);

      await expect(service.getBusinessLocations('u1')).rejects.toThrow(
        'Access token not found',
      );
    });

    it('should return locations', async () => {
      const setCredentials = jest.fn();

      const OAuth2Mock = google.auth.OAuth2 as unknown as jest.Mock;
      OAuth2Mock.mockImplementation(() => ({
        setCredentials,
      }));

      const accountsListMock = jest.fn().mockResolvedValue({
        data: { accounts: [{ name: 'accounts/123' }] },
      });

      const locationsListMock = jest.fn().mockResolvedValue({
        data: { locations: [{ name: 'loc1', title: 'Test Place' }] },
      });

      (google.mybusinessaccountmanagement as jest.Mock).mockReturnValue({
        accounts: { list: accountsListMock },
      });

      (google.mybusinessbusinessinformation as jest.Mock).mockReturnValue({
        accounts: { locations: { list: locationsListMock } },
      });

      sql.mockResolvedValueOnce([{ google_access_token: 'token' }]);

      const result = await service.getBusinessLocations('u1');

      expect(setCredentials).toHaveBeenCalled();
      expect(result.locations?.length).toBe(1);
    });
  });

  describe('getRestaurants', () => {
    it('should insert and return restaurants', async () => {
      jest.spyOn(service, 'getBusinessLocations').mockResolvedValue({
        locations: [
          {
            name: 'place1',
            title: 'My Place',
            storefrontAddress: { addressLines: ['Street 1'] },
          },
        ],
      });

      sql.mockResolvedValueOnce([{ id: '1', name: 'My Place' }]);

      const result = await service.getRestaurants('u1');

      expect(sql).toHaveBeenCalled();
      expect(result.restaurants.length).toBe(1);
    });
  });

  describe('updateRestaurantInfo', () => {
    it('should update restaurant info', async () => {
      sql.mockResolvedValueOnce([]);

      await service.updateRestaurantInfo('1', {
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

      const result = await service.getAutoReply('1');

      expect(result).not.toBeNull();
    });

    it('should return null if not found', async () => {
      sql.mockResolvedValueOnce([]);

      const result = await service.getAutoReply('1');

      expect(result).toBeNull();
    });
  });

  describe('updateAutoReply', () => {
    it('should update auto reply', async () => {
      sql.mockResolvedValueOnce([]);

      await service.updateAutoReply('1', {
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
