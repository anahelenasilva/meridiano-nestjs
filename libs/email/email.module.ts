import { DynamicModule, Module } from '@nestjs/common';
import { EmailService } from './email.service';

@Module({})
export class EmailModule {
  static forRoot(): DynamicModule {
    return {
      module: EmailModule,
      // No ConfigModule import: ConfigService is @Global() (registered once
      // via AppModule); importing ConfigModule here risks the same require()
      // cycle documented in redis.module.ts.
      providers: [EmailService],
      exports: [EmailService],
    };
  }
}
