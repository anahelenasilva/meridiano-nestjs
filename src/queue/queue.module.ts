import { Module, forwardRef } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ArticlesModule } from '../articles/articles.module';
import { ConfigModule } from '../config/config.module';
import { ProcessorModule } from '../processor/processor.module';
import {
  ARTICLE_PROCESSING_QUEUE,
  YOUTUBE_TRANSCRIPTION_SUMMARY_QUEUE,
} from '../shared/types/queue.constants';
import { YoutubeTranscriptionsModule } from '../youtube-transcriptions/youtube-transcriptions.module';
import { ArticleProcessor } from './processors/article.processor';
import { YoutubeTranscriptionProcessor } from './processors/youtube-transcription.processor';
import { QueueService } from './queue.service';
import { RedisService } from './redis.service';

@Module({
  imports: [
    forwardRef(() => ArticlesModule),
    forwardRef(() => YoutubeTranscriptionsModule),
    ProcessorModule,
    ConfigModule,
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
      provide: YOUTUBE_TRANSCRIPTION_SUMMARY_QUEUE,
      useFactory: (redisService: RedisService) => {
        return new Queue(YOUTUBE_TRANSCRIPTION_SUMMARY_QUEUE, {
          connection: redisService.getClient(),
        });
      },
      inject: [RedisService],
    },
    ArticleProcessor,
    YoutubeTranscriptionProcessor,
    QueueService,
  ],
  exports: [
    ARTICLE_PROCESSING_QUEUE,
    YOUTUBE_TRANSCRIPTION_SUMMARY_QUEUE,
    RedisService,
    QueueService,
  ],
})
export class QueueModule { }
