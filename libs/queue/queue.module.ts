import { EmailModule } from '@libs/email';
import { RedisModule, RedisService } from '@libs/redis';
import { S3Module } from '@libs/s3';
import { Module, forwardRef } from '@nestjs/common';
import { Queue } from 'bullmq';
import { AudioFilesModule } from '../../src/audio-files/audio-files.module';
import { ConfigModule } from '../../src/config/config.module';
import { ProcessorModule } from '../../src/processor/processor.module';
import {
  ARTICLE_PROCESSING_QUEUE,
  AUDIO_GENERATION_QUEUE,
  MARKDOWN_ARTICLE_PROCESSING_QUEUE,
  YOUTUBE_TRANSCRIPTION_SUMMARY_QUEUE,
} from './constants/queue.constants';
import { ArticleProcessor } from './processors/article.processor';
import { AudioGenerationProcessor } from './processors/audio-generation.processor';
import { QueueService } from './queue.service';
import { AudioJobService } from './services/audio-job.service';

@Module({
  imports: [
    forwardRef(() => ProcessorModule),
    forwardRef(() => AudioFilesModule), // Resolves circular dependency
    ConfigModule,
    EmailModule.forRoot(),
    S3Module,
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
    ArticleProcessor,
    AudioJobService,
    AudioGenerationProcessor,
    QueueService,
  ],
  exports: [
    ARTICLE_PROCESSING_QUEUE,
    MARKDOWN_ARTICLE_PROCESSING_QUEUE,
    YOUTUBE_TRANSCRIPTION_SUMMARY_QUEUE,
    AUDIO_GENERATION_QUEUE,
    AudioJobService,
    QueueService,
  ],
})
export class QueueModule { }
