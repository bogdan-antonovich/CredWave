import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { BillingService } from './billing.service';
import { getLoggerToken } from 'nestjs-pino';
import { AppConfigService } from '../config/config.service';
import { EmailService } from '../email/email.serivice';

const mockGetInvoicePDF = jest.fn();

const mockSubscriptionsUpdate = jest.fn();

const mockPaddle = {
  transactions: { getInvoicePDF: mockGetInvoicePDF },
  customerPortalSessions: { create: jest.fn() },
  webhooks: { unmarshal: jest.fn() },
  subscriptions: { update: mockSubscriptionsUpdate },
};

const mockSql = jest.fn().mockResolvedValue([]);

const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  trace: jest.fn(),
};

async function buildService(): Promise<BillingService> {
  const module = await Test.createTestingModule({
    providers: [
      BillingService,
      { provide: 'SQL', useValue: mockSql },
      { provide: 'PADDLE', useValue: mockPaddle },
      { provide: AppConfigService, useValue: { get: jest.fn() } },
      { provide: EmailService, useValue: { sendSubscriptionStarted: jest.fn() } },
      { provide: getLoggerToken(BillingService.name), useValue: mockLogger },
    ],
  }).compile();
  return module.get(BillingService);
}

describe('BillingService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('changePlan', () => {
    it('uses prorated_immediately for an active subscription', async () => {
      mockSql.mockResolvedValueOnce([{ paddle_subscription_id: 'sub_abc', status: 'active' }]);
      mockSubscriptionsUpdate.mockResolvedValueOnce({});
      const service = await buildService();

      await service.changePlan('user_1', 'pri_scale', 'scale');

      expect(mockSubscriptionsUpdate).toHaveBeenCalledWith('sub_abc', expect.objectContaining({
        items: [{ priceId: 'pri_scale', quantity: 1 }],
        prorationBillingMode: 'prorated_immediately',
      }));
    });

    it('uses do_not_bill for a trialing subscription', async () => {
      mockSql.mockResolvedValueOnce([{ paddle_subscription_id: 'sub_trial', status: 'trialing' }]);
      mockSubscriptionsUpdate.mockResolvedValueOnce({});
      const service = await buildService();

      await service.changePlan('user_1', 'pri_growth', 'growth');

      expect(mockSubscriptionsUpdate).toHaveBeenCalledWith('sub_trial', expect.objectContaining({
        prorationBillingMode: 'do_not_bill',
      }));
    });

    it('throws NotFoundException when user has no subscription', async () => {
      mockSql.mockResolvedValueOnce([]);
      const service = await buildService();

      const err = await service.changePlan('user_1', 'pri_scale', 'scale').catch(e => e);
      expect(err.getStatus()).toBe(404);
    });
  });

  describe('getDownloadLink', () => {
    it('returns the URL when Paddle resolves one', async () => {
      mockGetInvoicePDF.mockResolvedValueOnce({ url: 'https://pdf.paddle.com/inv_123.pdf' });
      const service = await buildService();

      const result = await service.getDownloadLink('inv_123');

      expect(result).toEqual({ url: 'https://pdf.paddle.com/inv_123.pdf' });
      expect(mockGetInvoicePDF).toHaveBeenCalledWith('inv_123');
    });

    it('throws NotFoundException when Paddle returns null', async () => {
      mockGetInvoicePDF.mockResolvedValueOnce(null);
      const service = await buildService();

      await expect(service.getDownloadLink('inv_missing')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when Paddle returns undefined', async () => {
      mockGetInvoicePDF.mockResolvedValueOnce(undefined);
      const service = await buildService();

      await expect(service.getDownloadLink('inv_missing')).rejects.toThrow(NotFoundException);
    });
  });
});
