import { EmailModule } from '@libs/email';
import { S3Module } from '@libs/s3';
import { Module, forwardRef } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ConfigModule } from '../../src/config/config.module';
import { ProcessorModule } from '../../src/processor/processor.module';
import {
  ARTICLE_PROCESSING_QUEUE,
  MARKDOWN_ARTICLE_PROCESSING_QUEUE,
  YOUTUBE_TRANSCRIPTION_SUMMARY_QUEUE,
} from './constants/queue.constants';
import { ArticleProcessor } from './processors/article.processor';
import { QueueService } from './queue.service';
import { RedisService } from './redis.service';

@Module({
  imports: [
    forwardRef(() => ProcessorModule),
    ConfigModule,
    EmailModule.forRoot(),
    S3Module,
  ],
  providers: [
    RedisService,
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
    ArticleProcessor,
    QueueService,
  ],
  exports: [
    ARTICLE_PROCESSING_QUEUE,
    MARKDOWN_ARTICLE_PROCESSING_QUEUE,
    YOUTUBE_TRANSCRIPTION_SUMMARY_QUEUE,
    RedisService,
    QueueService,
  ],
})
export class QueueModule { }
