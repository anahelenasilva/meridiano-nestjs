import { QueueModule } from '@libs/queue';
import { RedisModule } from '@libs/redis';
import { Module } from '@nestjs/common';
import { AudioJobService } from './services/audio-job.service';

@Module({
  imports: [QueueModule, RedisModule],
  providers: [AudioJobService],
  exports: [AudioJobService],
})
export class AudioModule {}
