import { RedisModule } from '@libs/redis';
import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { AudioJobService } from './services/audio-job.service';

@Module({
  imports: [QueueModule, RedisModule],
  providers: [AudioJobService],
  exports: [AudioJobService],
})
export class AudioModule { }
