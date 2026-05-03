import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { configFactory } from './config.factory';
import { configValidationSchema } from './config.schema';
import { AppConfigService } from './config.service';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configFactory],
      validationSchema: configValidationSchema,
      validationOptions: {
        abortEarly: false,
      },
    }),
  ],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
