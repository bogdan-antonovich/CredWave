import { AppConfig } from './config.interface';
import * as fs from 'fs';

const readSecret = (secretName: string): string => {
  const secretPath = `/run/secrets/${secretName}`;
  try {
    return fs.readFileSync(secretPath, 'utf8').trim();
  } catch {
    throw new Error(`Failed to read secret: ${secretName}`);
  }
};

export const configFactory = (): AppConfig => ({
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: (process.env.NODE_ENV as AppConfig['nodeEnv']) ?? 'development',
  db: {
    connectUrl: readSecret('DATABASE_URL_FILE'),
  },
  jwt: {
    secret: readSecret('JWT_SECRET_FILE'),
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },
  google: {
    clientId: readSecret('GOOGLE_CLIENT_ID_FILE'),
    clientSecret: readSecret('GOOGLE_CLIENT_SECRET_FILE'),
    callbackUrl: process.env.GOOGLE_CALLBACK_URL!,
    places: {
      apiKey: readSecret('GOOGLE_PLACES_API_KEY_FILE'),
    },
  },
  tg: {
    botToken: readSecret('TG_BOT_TOKEN_FILE'),
    chatId: process.env.TG_CHAT_ID!,
  },
  paddle: {
    apiKey: readSecret('PADDLE_API_KEY_FILE'),
    webhookSecret: readSecret('PADDLE_WEBHOOK_SECRET_FILE'),
  },
  serpapi: {
    apiKey: readSecret('SERPAPI_API_KEY_FILE'),
  },
  openai: {
    apiKey: readSecret('OPENAI_API_KEY_FILE'),
    model: process.env.OPENAI_MODEL!,
  },
  admin: {
    Id: Number(process.env.ADMIN_ID!),
    password: readSecret('ADMIN_PASSWORD_FILE'),
  },
  frontendUrl: process.env.FRONTEND_URL!,
});
