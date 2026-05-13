import { Test } from '@nestjs/testing';
import { UsersService } from './users.service';
import type { User } from '../shared/types';
import { getLoggerToken } from 'nestjs-pino';

type SqlMock = jest.Mock<
  Promise<unknown[]>,
  [TemplateStringsArray, ...unknown[]]
> & { begin?: jest.Mock };

function makeSql(...rowSets: object[][]): SqlMock {
  let callIndex = 0;
  return jest
    .fn<Promise<unknown[]>, [TemplateStringsArray, ...unknown[]]>()
    .mockImplementation(() => Promise.resolve(rowSets[callIndex++] ?? []));
}

function makeSqlWithBegin(...rowSets: object[][]): SqlMock {
  const sql = makeSql(...rowSets);
  const tx = jest.fn().mockResolvedValue([]);
  sql.begin = jest
    .fn()
    .mockImplementation((cb: (tx: typeof tx) => Promise<void>) => cb(tx));
  return sql;
}

const mockPaddle = {
  subscriptions: { cancel: jest.fn().mockResolvedValue({}) },
};

async function buildService(sql: SqlMock): Promise<UsersService> {
  const module = await Test.createTestingModule({
    providers: [
      UsersService,
      { provide: 'SQL', useValue: sql },
      { provide: 'PADDLE', useValue: mockPaddle },
      { provide: getLoggerToken(UsersService.name), useValue: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), trace: jest.fn() } },
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

  describe('disconnectGoogle', () => {
    let mockFetch: jest.Mock;

    beforeEach(() => {
      mockFetch = jest.fn().mockResolvedValue({ ok: true });
      global.fetch = mockFetch;
    });

    it('revokes the Google token when one exists', async () => {
      const sql = makeSqlWithBegin([{ token: 'ya29.existing-token' }]);
      const service = await buildService(sql);

      await service.disconnectGoogle('user-1');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('ya29.existing-token') as string,
        expect.objectContaining({ method: 'POST' }) as object,
      );
    });

    it('does not call fetch when no token exists', async () => {
      const sql = makeSqlWithBegin([]);
      const service = await buildService(sql);

      await service.disconnectGoogle('user-1');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('still deletes DB rows even if Google revoke throws', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      const sql = makeSqlWithBegin([{ token: 'ya29.existing-token' }]);
      const service = await buildService(sql);

      await expect(service.disconnectGoogle('user-1')).resolves.not.toThrow();
      expect(sql.begin).toHaveBeenCalled();
    });

    it('runs the deletion in a transaction', async () => {
      const sql = makeSqlWithBegin([{ token: 'ya29.existing-token' }]);
      const service = await buildService(sql);

      await service.disconnectGoogle('user-1');

      expect(sql.begin).toHaveBeenCalled();
    });
  });

  describe('deleteAccount', () => {
    it('cancels the Paddle subscription when an active one exists', async () => {
      const sql = makeSqlWithBegin([{ paddle_subscription_id: 'sub_123' }]);
      const service = await buildService(sql);

      await service.deleteAccount('user-1');

      expect(mockPaddle.subscriptions.cancel).toHaveBeenCalledWith(
        'sub_123',
        expect.objectContaining({ effectiveFrom: 'immediately' }) as object,
      );
    });

    it('does not call paddle.cancel when no active subscription', async () => {
      const sql = makeSqlWithBegin([]);
      const service = await buildService(sql);

      await service.deleteAccount('user-1');

      expect(mockPaddle.subscriptions.cancel).not.toHaveBeenCalled();
    });

    it('still deletes data even if Paddle cancel throws', async () => {
      mockPaddle.subscriptions.cancel.mockRejectedValueOnce(
        new Error('Paddle error'),
      );
      const sql = makeSqlWithBegin([{ paddle_subscription_id: 'sub_123' }]);
      const service = await buildService(sql);

      await expect(service.deleteAccount('user-1')).resolves.not.toThrow();
      expect(sql.begin).toHaveBeenCalled();
    });

    it('runs all deletions in a transaction', async () => {
      const sql = makeSqlWithBegin([]);
      const service = await buildService(sql);

      await service.deleteAccount('user-1');

      expect(sql.begin).toHaveBeenCalled();
    });

    it('passes userId to the subscription lookup', async () => {
      const sql = makeSqlWithBegin([]);
      const service = await buildService(sql);

      await service.deleteAccount('user-99');

      expect(sql.mock.calls[0]).toContain('user-99');
    });
  });
});
