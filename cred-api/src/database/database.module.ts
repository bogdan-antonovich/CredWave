import { Module, Global } from '@nestjs/common';
import { AppConfigService } from '../config/config.service';
import postgres from 'postgres';

@Global()
@Module({
  providers: [
    {
      provide: 'SQL',
      inject: [AppConfigService],
      useFactory: (cfg: AppConfigService) => postgres(cfg.get('db').connectUrl),
    },
  ],
  exports: ['SQL'],
})
export class DatabaseModule {}
