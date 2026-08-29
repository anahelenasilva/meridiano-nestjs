import { EmailModule } from '@libs/email';
import { RedisModule, RedisService } from '@libs/redis';
import { Module } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ConfigModule } from '../../src/config/config.module';
import {
  ARTICLE_PROCESSING_QUEUE,
  AUDIO_GENERATION_QUEUE,
  CUSTOM_BRIEFING_GENERATION_QUEUE,
  MARKDOWN_ARTICLE_PROCESSING_QUEUE,
  TRANSCRIPT_BACKUP_QUEUE,
  YOUTUBE_TRANSCRIPT_INGEST_QUEUE,
  YOUTUBE_TRANSCRIPTION_SUMMARY_QUEUE
} from './constants/queue.constants';
import { QueueService } from './queue.service';

@Module({
  imports: [
    ConfigModule,
    EmailModule.forRoot(),
    RedisModule,
  ],
  providers: [
    {
      provide: ARTICLE_PROCESSING_QUEUE,
      useFactory: (redisService: RedisService) => {
        return new Queue(ARTICLE_PROCESSING_QUEUE, {
          connection: redisService.getClient(),
        });
      },
      inject: [RedisService],
    },
    {
      provide: MARKDOWN_ARTICLE_PROCESSING_QUEUE,
      useFactory: (redisService: RedisService) => {
        return new Queue(MARKDOWN_ARTICLE_PROCESSING_QUEUE, {
          connection: redisService.getClient(),
        });
      },
      inject: [RedisService],
    },
    {
      provide: YOUTUBE_TRANSCRIPTION_SUMMARY_QUEUE,
      useFactory: (redisService: RedisService) => {
        return new Queue(YOUTUBE_TRANSCRIPTION_SUMMARY_QUEUE, {
          connection: redisService.getClient(),
        });
      },
      inject: [RedisService],
    },
    {
      provide: CUSTOM_BRIEFING_GENERATION_QUEUE,
      useFactory: (redisService: RedisService) => {
        return new Queue(CUSTOM_BRIEFING_GENERATION_QUEUE, {
          connection: redisService.getClient(),
        });
      },
      inject: [RedisService],
    },
    {
      provide: AUDIO_GENERATION_QUEUE,
      useFactory: (redisService: RedisService) => {
        return new Queue(AUDIO_GENERATION_QUEUE, {
          connection: redisService.getClient(),
          defaultJobOptions: {
            attempts: 2,
            backoff: { type: 'exponential', delay: 2000 },
            removeOnComplete: { count: 100 },
            removeOnFail: { count: 500 },
          },
        });
      },
      inject: [RedisService],
    },
    {
      provide: YOUTUBE_TRANSCRIPT_INGEST_QUEUE,
      useFactory: (redisService: RedisService) => {
        return new Queue(YOUTUBE_TRANSCRIPT_INGEST_QUEUE, {
          connection: redisService.getClient(),
          defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: { count: 100 },
            // Failed jobs are the dismissible strip on the transcriptions page,
            // so they stay until the user removes them.
            removeOnFail: false,
          },
        });
      },
      inject: [RedisService],
    },
    {
      provide: TRANSCRIPT_BACKUP_QUEUE,
      useFactory: (redisService: RedisService) => {
        return new Queue(TRANSCRIPT_BACKUP_QUEUE, {
          connection: redisService.getClient(),
          defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: true,
            removeOnFail: false,
          },
        });
      },
      inject: [RedisService],
    },
    QueueService,
  ],
  exports: [
    ARTICLE_PROCESSING_QUEUE,
    MARKDOWN_ARTICLE_PROCESSING_QUEUE,
    YOUTUBE_TRANSCRIPTION_SUMMARY_QUEUE,
    CUSTOM_BRIEFING_GENERATION_QUEUE,
    AUDIO_GENERATION_QUEUE,
    YOUTUBE_TRANSCRIPT_INGEST_QUEUE,
    TRANSCRIPT_BACKUP_QUEUE,
    QueueService,
  ],
})
export class QueueModule { }
