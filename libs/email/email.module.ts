import { DynamicModule, Module } from '@nestjs/common';
import { EmailService } from './email.service';

@Module({})
export class EmailModule {
  static forRoot(): DynamicModule {
    return {
      module: EmailModule,
      // ConfigService is @Global(); importing ConfigModule here risks the
      // require() cycle documented in redis.module.ts.
      providers: [EmailService],
      exports: [EmailService],
    };
  }
}
