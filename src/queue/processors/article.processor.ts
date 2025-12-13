import { Injectable, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { ProcessorService } from '../../processor/processor.service';
import {
  ARTICLE_PROCESSING_QUEUE
} from '../../shared/types/queue.constants';
import { ProcessArticleJobData } from '../interfaces/article-job.interface';
import { RedisService } from '../redis.service';

@Injectable()
export class ArticleProcessor implements OnModuleInit {
  private worker: Worker;

  constructor(
    private readonly redisService: RedisService,
    private readonly processorService: ProcessorService,
  ) { }

  onModuleInit() {
    this.worker = new Worker(
      ARTICLE_PROCESSING_QUEUE,
      async (job: Job<ProcessArticleJobData>) => {
        return await this.processArticle(job);
      },
      {
        connection: this.redisService.getClient(),
        concurrency: 1,
      },
    );

    this.worker.on('completed', (job) => {
      console.log(`Job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`Job ${job?.id} failed with error:`, err);
    });

    console.log('Article processor worker initialized');
  }

  async processArticle(
    job: Job<ProcessArticleJobData>,
  ): Promise<{ success: boolean; message: string }> {
    const { articleId, feedProfile } = job.data;

    console.log(
      `\n>>> Processing article ID ${articleId} from queue (Job ${job.id}) <<<`,
    );

    try {
      // Step 1: Process (summarize and embed)
      console.log(`Step 1: Processing article ${articleId}...`);
      const processStats = await this.processorService.processArticles(
        feedProfile,
        1,
        articleId,
      );

      if (processStats.errors > 0 || processStats.articlesProcessed === 0) {
        throw new Error('Failed to process article');
      }

      // Step 2: Rate
      console.log(`Step 2: Rating article ${articleId}...`);
      const rateStats = await this.processorService.rateArticles(
        feedProfile,
        1,
        articleId,
      );

      if (rateStats.errors > 0 || rateStats.articlesRated === 0) {
        throw new Error('Failed to rate article');
      }

      // Step 3: Categorize
      console.log(`Step 3: Categorizing article ${articleId}...`);
      const categorizeStats = await this.processorService.categorizeArticles(
        feedProfile,
        1,
        articleId,
      );

      if (
        categorizeStats.errors > 0 ||
        categorizeStats.articlesCategorized === 0
      ) {
        throw new Error('Failed to categorize article');
      }

      console.log(
        `✓ Article ${articleId} processing completed successfully (Job ${job.id})`,
      );

      return {
        success: true,
        message: `Article ${articleId} processed, rated, and categorized successfully`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(
        `Error processing article ${articleId} in job ${job.id}:`,
        errorMessage,
      );
      throw new Error(`Failed to process article ${articleId}: ${errorMessage}`);
    }
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
    }
  }
}
