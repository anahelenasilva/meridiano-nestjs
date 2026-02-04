import { RedisModule, RedisService } from '@libs/redis';
import { Module } from '@nestjs/common';
import { Queue } from 'bullmq';
import { AUDIO_GENERATION_QUEUE } from '../queue/constants/queue.constants';
import { AudioJobService } from './services/audio-job.service';

@Module({
  imports: [
    RedisModule,
  ],
  providers: [
    {
      provide: AUDIO_GENERATION_QUEUE,
      useFactory: (redisService: RedisService) => {
        return new Queue(AUDIO_GENERATION_QUEUE, {
          connection: redisService.getClient(),
          defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
            removeOnComplete: { count: 100 },
            removeOnFail: { count: 500 },
          },
        });
      },
      inject: [RedisService],
    },
    AudioJobService,
  ],
  exports: [
    AUDIO_GENERATION_QUEUE,
    AudioJobService,
  ],
})
export class AudioModule { }
