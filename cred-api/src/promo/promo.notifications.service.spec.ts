import { Test } from '@nestjs/testing';
import { getLoggerToken } from 'nestjs-pino';
import { PromoNotificationsService } from './promo.notifications.service';
import { EmailService } from '../email/email.serivice';

const mockEmail = {
  sendPromoExpiringSoon: jest.fn(),
  sendPromoExpired: jest.fn(),
};

async function buildService(sql: jest.Mock): Promise<PromoNotificationsService> {
  const module = await Test.createTestingModule({
    providers: [
      PromoNotificationsService,
      { provide: 'SQL', useValue: sql },
      { provide: EmailService, useValue: mockEmail },
      {
        provide: getLoggerToken(PromoNotificationsService.name),
        useValue: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), trace: jest.fn() },
      },
    ],
  }).compile();
  return module.get<PromoNotificationsService>(PromoNotificationsService);
}

const FUTURE = new Date(Date.now() + 86400000 * 2);
const PAST = new Date(Date.now() - 86400000);

function makeUser(override: object = {}) {
  return {
    id: 1,
    email: 'u@test.com',
    name: 'User',
    promo_code: 'CODE30',
    promo_access_until: FUTURE,
    ...override,
  };
}

describe('PromoNotificationsService', () => {
  let sql: jest.Mock;

  beforeEach(() => {
    sql = jest.fn();
    jest.clearAllMocks();
  });

  // Promise.all fires all 4 SELECTs concurrently (7d, 3d, 1d, expired),
  // then UPDATEs follow for whichever windows found users.
  describe('runNotifications', () => {
    it('sends 7d notice and marks flag', async () => {
      const user = makeUser();
      sql
        .mockResolvedValueOnce([user]) // SELECT 7d
        .mockResolvedValueOnce([])     // SELECT 3d
        .mockResolvedValueOnce([])     // SELECT 1d
        .mockResolvedValueOnce([])     // SELECT expired
        .mockResolvedValueOnce(undefined); // UPDATE 7d

      const service = await buildService(sql);
      await service.runNotifications();

      expect(mockEmail.sendPromoExpiringSoon).toHaveBeenCalledWith(
        user.email, user.name, user.promo_code, 7, expect.any(String),
      );
    });

    it('sends 3d notice and marks flag', async () => {
      const user = makeUser();
      sql
        .mockResolvedValueOnce([])     // SELECT 7d
        .mockResolvedValueOnce([user]) // SELECT 3d
        .mockResolvedValueOnce([])     // SELECT 1d
        .mockResolvedValueOnce([])     // SELECT expired
        .mockResolvedValueOnce(undefined); // UPDATE 3d

      const service = await buildService(sql);
      await service.runNotifications();

      expect(mockEmail.sendPromoExpiringSoon).toHaveBeenCalledWith(
        user.email, user.name, user.promo_code, 3, expect.any(String),
      );
    });

    it('sends 1d notice and marks flag', async () => {
      const user = makeUser();
      sql
        .mockResolvedValueOnce([])     // SELECT 7d
        .mockResolvedValueOnce([])     // SELECT 3d
        .mockResolvedValueOnce([user]) // SELECT 1d
        .mockResolvedValueOnce([])     // SELECT expired
        .mockResolvedValueOnce(undefined); // UPDATE 1d

      const service = await buildService(sql);
      await service.runNotifications();

      expect(mockEmail.sendPromoExpiringSoon).toHaveBeenCalledWith(
        user.email, user.name, user.promo_code, 1, expect.any(String),
      );
    });

    it('sends expired notice and marks flag', async () => {
      const user = makeUser({ promo_access_until: PAST });
      sql
        .mockResolvedValueOnce([])     // SELECT 7d
        .mockResolvedValueOnce([])     // SELECT 3d
        .mockResolvedValueOnce([])     // SELECT 1d
        .mockResolvedValueOnce([user]) // SELECT expired
        .mockResolvedValueOnce(undefined); // UPDATE expired

      const service = await buildService(sql);
      await service.runNotifications();

      expect(mockEmail.sendPromoExpired).toHaveBeenCalledWith(
        user.email, user.name, user.promo_code,
      );
    });

    it('sends nothing when no users match any window', async () => {
      sql
        .mockResolvedValueOnce([]) // SELECT 7d
        .mockResolvedValueOnce([]) // SELECT 3d
        .mockResolvedValueOnce([]) // SELECT 1d
        .mockResolvedValueOnce([]); // SELECT expired

      const service = await buildService(sql);
      await service.runNotifications();

      expect(mockEmail.sendPromoExpiringSoon).not.toHaveBeenCalled();
      expect(mockEmail.sendPromoExpired).not.toHaveBeenCalled();
    });
  });
});
