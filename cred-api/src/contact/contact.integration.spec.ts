import { LoggerModule } from 'nestjs-pino';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'http';
import postgres, { type Sql } from 'postgres';
import { Bot } from 'grammy';
import { AppConfigService } from '../config/config.service';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';

type ContactResponse = {
  success: boolean;
  message: string;
};

const mockSendMessage = jest.fn();

const mockBot = {
  api: {
    sendMessage: mockSendMessage,
  },
} as unknown as Bot;

describe('/contact route', () => {
  let sql: Sql;
  let app: INestApplication;
  let server: Server;

  beforeAll(() => {
    sql = postgres(global.__DATABASE_URL__);
  });

  afterAll(async () => {
    await sql.end();
  });

  beforeEach(async () => {
    jest.resetAllMocks();

    // clean DB
    await sql`
      TRUNCATE contacts CASCADE
    `;

    const moduleRef = await Test.createTestingModule({
      imports: [LoggerModule.forRoot({ pinoHttp: { level: 'silent' } })],
      controllers: [ContactController],
      providers: [
        ContactService,
        { provide: 'SQL', useValue: sql },
        { provide: 'TG_BOT', useValue: mockBot },
        {
          provide: AppConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'tg') return { chatId: '123456' };
              throw new Error(`Unknown config key: ${key}`);
            },
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    server = app.getHttpServer() as Server;
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /contact', () => {
    const payload = {
      name: 'John Doe',
      email: 'john@example.com',
      message: 'Hello there',
    };

    it('creates contact, sends telegram message, and returns success', async () => {
      const res = await request(server)
        .post('/contact')
        .send(payload)
        .expect(201);

      const body = res.body as ContactResponse;

      expect(body.success).toBe(true);
      expect(body.message).toContain('24 hours');

      // DB check
      const rows = await sql`
        SELECT * FROM contacts WHERE email = ${payload.email}
      `;
      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe(payload.name);
      expect(rows[0].message).toBe(payload.message);

      // Telegram check
      expect(mockSendMessage).toHaveBeenCalledWith(
        '123456',
        expect.stringContaining(payload.name),
        expect.objectContaining({ parse_mode: 'Markdown' }),
      );
    });

    it('fails if DB insert throws', async () => {
      jest
        .spyOn(app.get(ContactService), 'newContact')
        .mockRejectedValueOnce(new Error('DB error'));

      await request(server).post('/contact').send(payload).expect(500);
    });

    it('fails if telegram sendMessage throws', async () => {
      mockSendMessage.mockRejectedValueOnce(new Error('TG error'));

      await request(server).post('/contact').send(payload).expect(500);
    });
  });
});
