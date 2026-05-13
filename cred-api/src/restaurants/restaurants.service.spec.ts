import { Test } from '@nestjs/testing';
import { RestaurantsService } from './restaurants.service';
import { AppConfigService } from 'src/config/config.service';
import { GoogleTokensService } from '../auth/auth.service';
import { google } from 'googleapis';
import { RestaurantChanges } from './restaurants.types';
import { getLoggerToken } from 'nestjs-pino';

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
  let mockGoogleTokens: { withAutoRefresh: jest.Mock };

  const configMock = {
    get: jest.fn((key: string) => {
      if (key === 'google') return { places: { apiKey: 'fake-key' } };
    }),
  };

  beforeEach(async () => {
    sql = jest.fn();
    mockGoogleTokens = {
      withAutoRefresh: jest.fn().mockImplementation(
        (_: string, fn: (token: string) => Promise<unknown>) => fn('TOKEN123'),
      ),
    };

    const module = await Test.createTestingModule({
      providers: [
        RestaurantsService,
        { provide: 'SQL', useValue: sql },
        { provide: AppConfigService, useValue: configMock },
        { provide: GoogleTokensService, useValue: mockGoogleTokens },
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

  describe('getBusinessLocations', () => {
    it('should call withAutoRefresh with the userId', async () => {
      const OAuth2Mock = google.auth.OAuth2 as unknown as jest.Mock;
      OAuth2Mock.mockImplementation(() => ({ setCredentials: jest.fn() }));

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

      mockGoogleTokens.withAutoRefresh.mockImplementation(
        (_: string, fn: (token: string) => Promise<unknown>) => fn('TOKEN123'),
      );

      const result = await service.getBusinessLocations('u1');

      expect(mockGoogleTokens.withAutoRefresh).toHaveBeenCalledWith('u1', expect.any(Function));
      expect(result.locations?.length).toBe(1);
    });

    it('should pass the token to OAuth2 setCredentials', async () => {
      const setCredentials = jest.fn();
      const OAuth2Mock = google.auth.OAuth2 as unknown as jest.Mock;
      OAuth2Mock.mockImplementation(() => ({ setCredentials }));

      (google.mybusinessaccountmanagement as jest.Mock).mockReturnValue({
        accounts: {
          list: jest.fn().mockResolvedValue({ data: { accounts: [{ name: 'accounts/123' }] } }),
        },
      });
      (google.mybusinessbusinessinformation as jest.Mock).mockReturnValue({
        accounts: {
          locations: {
            list: jest.fn().mockResolvedValue({ data: { locations: [] } }),
          },
        },
      });

      mockGoogleTokens.withAutoRefresh.mockImplementation(
        (_: string, fn: (token: string) => Promise<unknown>) => fn('TOKEN123'),
      );

      await service.getBusinessLocations('u1');

      expect(setCredentials).toHaveBeenCalledWith({ access_token: 'TOKEN123' });
    });

    it('propagates errors from withAutoRefresh', async () => {
      mockGoogleTokens.withAutoRefresh.mockRejectedValueOnce(new Error('No token'));

      await expect(service.getBusinessLocations('u1')).rejects.toThrow('No token');
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
