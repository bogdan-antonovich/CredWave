import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AppConfigService } from '../config/config.service';
import {
  AppTokensService,
  GoogleTokensService,
  AuthService,
} from './auth.service';
import { getLoggerToken } from 'nestjs-pino';

jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        setCredentials: jest.fn(),
        refreshAccessToken: jest.fn().mockResolvedValue({
          credentials: {
            access_token: 'new-access-token',
            expiry_date: Date.now() + 3600 * 1000,
          },
        }),
      })),
    },
  },
}));

describe('AppTokensService', () => {
  let service: AppTokensService;
  let sql: jest.Mock;

  beforeEach(async () => {
    sql = jest.fn();

    const module = await Test.createTestingModule({
      providers: [
        AppTokensService,
        { provide: 'SQL', useValue: sql },
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('signed-token') },
        },
        { provide: getLoggerToken(AppTokensService.name), useValue: { debug: jest.fn() } },
      ],
    }).compile();

    service = module.get<AppTokensService>(AppTokensService);
  });

  describe('isBlacklisted', () => {
    it('should return true when token is blacklisted', async () => {
      sql.mockResolvedValueOnce([{ 1: 1 }]);
      const result = await service.isBlacklisted('some-token');
      expect(result).toBe(true);
    });

    it('should return false when token is not blacklisted', async () => {
      sql.mockResolvedValueOnce([]);
      const result = await service.isBlacklisted('some-token');
      expect(result).toBe(false);
    });
  });

  describe('refresh', () => {
    it('should return new tokens when refresh token is valid', async () => {
      sql.mockResolvedValueOnce([{ user_id: 'user-123' }]); // getUserIdByRefreshToken
      sql.mockResolvedValueOnce([]); // saveRefreshToken

      const result = await service.refresh('valid-refresh-token');

      expect(result).toMatchObject({
        access_token: 'signed-token',
        refresh_token: expect.any(String) as string,
      });
    });

    it('should return null when refresh token not found', async () => {
      sql.mockResolvedValueOnce([]); // no user found

      const result = await service.refresh('invalid-token');

      expect(result).toBeNull();
    });
  });
});

describe('AuthService', () => {
  let service: AuthService;
  let sql: jest.Mock;

  beforeEach(async () => {
    sql = jest.fn();

    const module = await Test.createTestingModule({
      providers: [AuthService, { provide: 'SQL', useValue: sql }],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('getOrCreateUser', () => {
    it('should return existing user if found', async () => {
      const existing = {
        id: 'uuid',
        email: 'test@test.com',
        name: 'Test',
        picture_url: null,
      };
      sql.mockResolvedValueOnce([existing]);

      const result = await service.getOrCreateUser('test@test.com', null, null);

      expect(result).toEqual(existing);
    });

    it('should create and return new user if not found', async () => {
      const created = {
        id: 'new-uuid',
        email: 'test@test.com',
        name: 'Test',
        picture_url: null,
      };
      sql.mockResolvedValueOnce([]); // no existing user
      sql.mockResolvedValueOnce([created]); // insert result

      const result = await service.getOrCreateUser(
        'test@test.com',
        'Test',
        null,
      );

      expect(result).toEqual(created);
    });
  });
});

describe('GoogleTokensService', () => {
  let service: GoogleTokensService;
  let sql: jest.Mock;

  beforeEach(async () => {
    sql = jest.fn();

    const module = await Test.createTestingModule({
      providers: [
        GoogleTokensService,
        { provide: 'SQL', useValue: sql },
        {
          provide: AppConfigService,
          useValue: { get: jest.fn().mockReturnValue('mock-value') },
        },
      ],
    }).compile();

    service = module.get<GoogleTokensService>(GoogleTokensService);
  });

  describe('refreshGoogleAccessToken', () => {
    it('should refresh and save new access token', async () => {
      sql.mockResolvedValueOnce([]); // saveAccessToken

      const result = await service.refreshGoogleAccessToken(
        'user-123',
        'refresh-token',
      );

      expect(result).toBe('new-access-token');
      expect(sql).toHaveBeenCalledTimes(1);
    });
  });
});
