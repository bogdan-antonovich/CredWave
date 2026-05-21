export interface AppConfig {
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  logLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  db: {
    connectUrl: string;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
  google: {
    clientId: string;
    clientSecret: string;
    callbackUrl: string;
    places: {
      apiKey: string;
    };
  };
  tg: {
    botToken: string;
    chatId: string;
  };
  paddle: {
    apiKey: string;
    webhookSecret: string;
  };
  serpapi: {
    apiKey: string;
  };
  outscraper: {
    apiKey: string;
  };
  openai: {
    apiKey: string;
    model: string;
  };
  admin: {
    Id: number;
    password: string;
  };
  frontendUrl: string;
  resendApiKey: string;
}
