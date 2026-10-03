import { AudioJobService } from '@libs/audio';
import { ARTICLE_PROCESSING_QUEUE, ProcessArticleJobData } from '@libs/queue';
import { createWorker } from '@libs/queue/create-worker';
import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Queue, Worker } from 'bullmq';
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
    @Inject(ARTICLE_PROCESSING_QUEUE)
    private readonly queue: Queue,
    private readonly pipeline: ArticleProcessingPipelineService,
    private readonly articlesService: ArticlesService,
    private readonly audioJobService: AudioJobService,
  ) {}

  onModuleInit() {
    this.worker = createWorker(
      this.queue,
      (job: Job<ProcessArticleJobData>) => this.handleJob(job),
      { logger: this.logger },
    );

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
