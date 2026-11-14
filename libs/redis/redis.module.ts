import { Module } from '@nestjs/common';
import { RedisService } from './redis.service';

// No ConfigModule import here: ConfigService is @Global(), registered once
// via AppModule.
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
