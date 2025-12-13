import { Module, forwardRef } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ArticlesModule } from '../articles/articles.module';
import { ConfigModule } from '../config/config.module';
import { ProcessorModule } from '../processor/processor.module';
import { ARTICLE_PROCESSING_QUEUE } from '../shared/types/queue.constants';
import { ArticleProcessor } from './processors/article.processor';
import { QueueService } from './queue.service';
import { RedisService } from './redis.service';

@Module({
  imports: [
    forwardRef(() => ArticlesModule),
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
    ArticleProcessor,
    QueueService,
  ],
  exports: [ARTICLE_PROCESSING_QUEUE, RedisService, QueueService],
})
export class QueueModule { }
