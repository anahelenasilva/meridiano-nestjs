import { AudioJobService } from '@libs/audio';
import { ARTICLE_PROCESSING_QUEUE, ProcessArticleJobData } from '@libs/queue';
import { RedisService } from '@libs/redis';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { ArticlesService } from '../../articles/articles.service';
import { enqueueArticleAudio } from '../enqueue-article-audio';
import { ArticleProcessingPipelineService } from '../pipeline/article-processing-pipeline.service';

/**
 * Thin Bull adapter around the article processing pipeline. Its only job is:
 * deserialise the job -> run the pipeline -> ack or fail. Audio generation is
 * enqueued here (the caller's responsibility) and is deliberately not part of
 * the pipeline module.
 */
@Injectable()
export class ArticleProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ArticleProcessor.name);
  private worker: Worker;

  constructor(
    private readonly redisService: RedisService,
    private readonly pipeline: ArticleProcessingPipelineService,
    private readonly articlesService: ArticlesService,
    private readonly audioJobService: AudioJobService,
  ) {}

  onModuleInit() {
    this.worker = new Worker(
      ARTICLE_PROCESSING_QUEUE,
      async (job: Job<ProcessArticleJobData>) => {
        return await this.handleJob(job);
      },
      {
        connection: this.redisService.getClient(),
        concurrency: 1,
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Job ${job?.id} failed with error:`, err);
    });

    // Suppress expected ECONNRESET/closed errors during shutdown so they do not
    // crash tests when the Redis connection closes.
    this.worker.on('error', (err: Error) => {
      if (err.message?.includes('ECONNRESET') || err.message?.includes('closed')) {
        return;
      }
      this.logger.error('Article processor worker error:', err);
    });

    this.logger.log('Article processor worker initialized');
  }

  async handleJob(
    job: Job<ProcessArticleJobData>,
  ): Promise<{ success: boolean; message: string }> {
    const { articleFileKey: articleId, generateAudio } = job.data;

    const article =
      await this.articlesService.getUnprocessedArticleById(articleId);
    if (!article) {
      throw new Error(`Article ${articleId} not found or already processed`);
    }

    const result = await this.pipeline.processArticle(article);

    if (!result.success) {
      throw new Error(
        `Failed to process article ${articleId} at ${result.failedStep} step: ${result.error}`,
      );
    }

    if (generateAudio) {
      await enqueueArticleAudio(
        this.audioJobService,
        this.logger,
        article,
        result.summary,
      );
    }

    return {
      success: true,
      message: `Article ${articleId} processed, rated, and categorized successfully`,
    };
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
    }
  }
}
