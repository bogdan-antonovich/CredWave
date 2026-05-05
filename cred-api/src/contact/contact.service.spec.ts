import { Test } from '@nestjs/testing';
import { ContactService } from './contact.service';
import { AppConfigService } from '../config/config.service';
import { getLoggerToken } from 'nestjs-pino';

describe('ContactService', () => {
  let service: ContactService;
  const sqlMock = jest.fn();
  const sendMessageMock = jest.fn();

  const botMock = {
    api: {
      sendMessage: sendMessageMock,
    },
  };

  const configMock = {
    get: jest.fn((key: string) => {
      if (key === 'tg') return { chatId: '123456', botToken: 'fake-token' };
      throw new Error(`Unknown config key: ${key}`);
    }),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ContactService,
        { provide: 'SQL', useValue: sqlMock },
        { provide: 'TG_BOT', useValue: botMock },
        { provide: AppConfigService, useValue: configMock },
        { provide: getLoggerToken(ContactService.name), useValue: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), trace: jest.fn() } },
      ],
    }).compile();

    service = module.get<ContactService>(ContactService);

    jest.clearAllMocks();
  });

  it('should insert into DB and send telegram message', async () => {
    const cf = {
      name: 'Bogdan',
      email: 'test@test.com',
      message: 'Hello',
    };

    await service.newContact(cf);

    expect(sqlMock).toHaveBeenCalled();

    expect(sendMessageMock).toHaveBeenCalledWith(
      '123456',
      expect.stringContaining('Bogdan'),
      { parse_mode: 'Markdown' },
    );
  });
});
