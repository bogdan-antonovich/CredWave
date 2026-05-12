import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getLoggerToken } from 'nestjs-pino';
import { PromoService } from './promo.service';

async function buildService(sql: jest.Mock): Promise<PromoService> {
  const module = await Test.createTestingModule({
    providers: [
      PromoService,
      { provide: 'SQL', useValue: sql },
      {
        provide: getLoggerToken(PromoService.name),
        useValue: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), trace: jest.fn() },
      },
    ],
  }).compile();
  return module.get<PromoService>(PromoService);
}

describe('PromoService', () => {
  let sql: jest.Mock;

  beforeEach(() => {
    sql = jest.fn();
  });

  describe('getPromoAccess', () => {
    it('returns code and accessUntil when user has active promo access', async () => {
      const until = new Date(Date.now() + 86400000);
      sql.mockResolvedValueOnce([{ promo_code: 'LAUNCH30', promo_access_until: until }]);
      const service = await buildService(sql);

      const result = await service.getPromoAccess(1);
      expect(result).toEqual({ code: 'LAUNCH30', accessUntil: until.toISOString() });
    });

    it('returns null when user has no active promo (empty result)', async () => {
      sql.mockResolvedValueOnce([]);
      const service = await buildService(sql);

      await expect(service.getPromoAccess(1)).resolves.toBeNull();
    });
  });

  describe('redeemPromoCode', () => {
    function setupBegin(tx: jest.Mock) {
      (sql as any).begin = jest.fn((cb: (tx: jest.Mock) => Promise<void>) =>
        cb(tx),
      );
    }

    function validTx(): jest.Mock {
      return jest.fn()
        .mockResolvedValueOnce([{ duration_days: 30 }]) // promo found
        .mockResolvedValueOnce([{ promo_code: null }])  // user hasn't redeemed yet
        .mockResolvedValueOnce(undefined)               // UPDATE users
        .mockResolvedValueOnce(undefined);              // UPDATE promo_codes
    }

    it('resolves when code is valid and user has not redeemed before', async () => {
      const tx = validTx();
      setupBegin(tx);
      const service = await buildService(sql);

      await expect(service.redeemPromoCode('LAUNCH30', 1)).resolves.toBeUndefined();
    });

    it('runs inside a transaction', async () => {
      setupBegin(validTx());
      const service = await buildService(sql);

      await service.redeemPromoCode('LAUNCH30', 1);

      expect((sql as any).begin).toHaveBeenCalledTimes(1);
    });

    it('makes exactly 4 queries inside the transaction', async () => {
      const tx = validTx();
      setupBegin(tx);
      const service = await buildService(sql);

      await service.redeemPromoCode('LAUNCH30', 1);

      expect(tx).toHaveBeenCalledTimes(4);
    });

    it('throws BadRequestException when code does not exist or fails validation', async () => {
      const tx = jest.fn().mockResolvedValueOnce([]); // no promo found
      setupBegin(tx);
      const service = await buildService(sql);

      await expect(service.redeemPromoCode('INVALID', 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when user has already redeemed a code', async () => {
      const tx = jest.fn()
        .mockResolvedValueOnce([{ duration_days: 30 }])   // promo found
        .mockResolvedValueOnce([{ promo_code: 'USED10' }]); // user already redeemed
      setupBegin(tx);
      const service = await buildService(sql);

      await expect(service.redeemPromoCode('LAUNCH30', 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('does not call UPDATE queries when code is invalid', async () => {
      const tx = jest.fn().mockResolvedValueOnce([]);
      setupBegin(tx);
      const service = await buildService(sql);

      await expect(service.redeemPromoCode('INVALID', 1)).rejects.toThrow();

      expect(tx).toHaveBeenCalledTimes(1);
    });

    it('does not call UPDATE queries when user already redeemed', async () => {
      const tx = jest.fn()
        .mockResolvedValueOnce([{ duration_days: 30 }])
        .mockResolvedValueOnce([{ promo_code: 'OTHER' }]);
      setupBegin(tx);
      const service = await buildService(sql);

      await expect(service.redeemPromoCode('LAUNCH30', 1)).rejects.toThrow();

      expect(tx).toHaveBeenCalledTimes(2);
    });
  });
});
