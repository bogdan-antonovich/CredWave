import { Test } from '@nestjs/testing';
import { UsersService } from './users.service';
import type { User } from '../shared/types';
import { getLoggerToken } from 'nestjs-pino';

type SqlMock = jest.Mock<
  Promise<unknown[]>,
  [TemplateStringsArray, ...unknown[]]
>;

function makeSql(...rowSets: object[][]): SqlMock {
  let callIndex = 0;
  return jest
    .fn<Promise<unknown[]>, [TemplateStringsArray, ...unknown[]]>()
    .mockImplementation(() => Promise.resolve(rowSets[callIndex++] ?? []));
}

async function buildService(sql: SqlMock): Promise<UsersService> {
  const module = await Test.createTestingModule({
    providers: [
      UsersService,
      { provide: 'SQL', useValue: sql },
      { provide: getLoggerToken(UsersService.name), useValue: { debug: jest.fn() } },
    ],
  }).compile();
  return module.get<UsersService>(UsersService);
}

const FAKE_USER: User = {
  id: 'user-1',
  email: 'alice@example.com',
  name: 'Alice',
  picture_url: 'https://example.com/alice.jpg',
  google_access_token: 'fake-google-token',
  created_at: new Date('2026-01-01'),
};

describe('UsersService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('getUserById', () => {
    it('returns the user when found', async () => {
      const service = await buildService(makeSql([FAKE_USER]));

      const result = await service.getUserbyId('user-1');

      expect(result).toEqual(FAKE_USER);
    });

    it('returns null when no user is found', async () => {
      const service = await buildService(makeSql([]));

      const result = await service.getUserbyId('nonexistent-id');

      expect(result).toBeNull();
    });

    it('queries by the provided user id', async () => {
      const sql = makeSql([FAKE_USER]);
      const service = await buildService(sql);

      await service.getUserbyId('user-1');

      expect(sql.mock.calls[0]).toContain('user-1');
    });
  });

  describe('getGoogleAccessTokenByUserId', () => {
    it('returns the access token when a row exists', async () => {
      const service = await buildService(
        makeSql([{ token: 'ya29.fake-token' }]),
      );

      const result = await service.getGoogleAccessTokenByUserId('user-1');

      expect(result).toBe('ya29.fake-token');
    });

    it('returns null when no token row exists', async () => {
      const service = await buildService(makeSql([]));

      const result = await service.getGoogleAccessTokenByUserId('user-1');

      expect(result).toBeNull();
    });

    it('queries by the provided user id', async () => {
      const sql = makeSql([{ token: 'ya29.fake-token' }]);
      const service = await buildService(sql);

      await service.getGoogleAccessTokenByUserId('user-1');

      expect(sql.mock.calls[0]).toContain('user-1');
    });
  });

  describe('isGoogleTokenValid', () => {
    const mockFetch = jest.fn<Promise<Response>, [RequestInfo, RequestInit?]>();

    beforeEach(() => {
      global.fetch = mockFetch;
    });

    it('returns true when Google responds with ok', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true } as Response);
      const service = await buildService(makeSql());

      const result = await service.isGoogleTokenValid('valid-token');

      expect(result).toBe(true);
    });

    it('returns false when Google responds with not ok', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false } as Response);
      const service = await buildService(makeSql());

      const result = await service.isGoogleTokenValid('expired-token');

      expect(result).toBe(false);
    });

    it('calls the tokeninfo endpoint with the provided access token', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true } as Response);
      const service = await buildService(makeSql());

      await service.isGoogleTokenValid('my-token');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('my-token') as string,
      );
    });

    it('calls the correct Google tokeninfo URL', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true } as Response);
      const service = await buildService(makeSql());

      await service.isGoogleTokenValid('my-token');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('oauth2.googleapis.com/tokeninfo') as string,
      );
    });
  });
});
