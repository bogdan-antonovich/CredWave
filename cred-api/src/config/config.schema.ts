import * as Joi from 'joi';

// here we go
export const configValidationSchema = Joi.object({
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  LOG_LEVEL: Joi.string()
    .valid('trace', 'debug', 'info', 'warn', 'error')
    .default('info'),

  JWT_EXPIRES_IN: Joi.string().default('7d'),

  GOOGLE_CALLBACK_URL: Joi.string().uri().required(),

  TG_CHAT_ID: Joi.string().required(),

  OPENAI_MODEL: Joi.string().required(),

  ADMIN_ID: Joi.number().integer().required(),

  FRONTEND_URL: Joi.string().uri().required(),
});
