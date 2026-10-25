import { Module } from '@nestjs/common';
import { RedisService } from './redis.service';

// No ConfigModule import here: ConfigService is @Global() (registered once
// via AppModule), and importing ConfigModule from this file would create a
// require() cycle (ConfigModule -> YoutubeChannelsModule -> its controller
// -> @libs/auth -> RedisModule, since AuthModule.forRootAsync() imports
// RedisModule).
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule { }
