import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { parseMarkdownArticle } from '../../articles/helpers/parse-markdown';
import { ArticlesService } from '../../articles/articles.service';
import { ProcessorService } from '../../processor/processor.service';
import { S3Service } from '../../../libs/s3/s3.service';
import { MARKDOWN_ARTICLE_PROCESSING_QUEUE } from '../../shared/types/queue.constants';
import { ProcessMarkdownArticleJobData } from '../interfaces/markdown-article-job.interface';
import { RedisService } from '../redis.service';

@Injectable()
export class MarkdownArticleProcessor implements OnModuleInit, OnModuleDestroy {
  private worker: Worker;

  constructor(
    private readonly redisService: RedisService,
    private readonly s3Service: S3Service,
    private readonly articlesService: ArticlesService,
    private readonly processorService: ProcessorService,
  ) { }

  onModuleInit() {
    this.worker = new Worker(
      MARKDOWN_ARTICLE_PROCESSING_QUEUE,
      async (job: Job<ProcessMarkdownArticleJobData>) => {
        return await this.processMarkdownArticle(job);
      },
      {
        connection: this.redisService.getClient(),
        concurrency: 1,
      },
    );

    this.worker.on('completed', (job) => {
      console.log(`Markdown article job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`Markdown article job ${job?.id} failed with error:`, err);
    });

    console.log('Markdown article processor worker initialized');
  }

  async processMarkdownArticle(
    job: Job<ProcessMarkdownArticleJobData>,
  ): Promise<{ success: boolean; message: string }> {
    const { s3Bucket, s3Key, feedProfile } = job.data;

    console.log(
      `\n>>> Processing markdown article from S3 (Job ${job.id}) <<<`,
    );
    console.log(`Bucket: ${s3Bucket}, Key: ${s3Key}`);

    try {
      console.log(`Step 1: Downloading markdown from S3...`);
      const markdownContent = await this.s3Service.downloadMarkdownFile(
        s3Bucket,
        s3Key,
      );

      console.log(`Step 2: Parsing markdown...`);
      const parsedArticle = parseMarkdownArticle(markdownContent);

      console.log(`Step 3: Creating article in database...`);
      const articleId = await this.articlesService.addArticle(
        `s3://${s3Bucket}/${s3Key}`,
        parsedArticle.title,
        parsedArticle.publishedDate,
        'S3 Upload',
        parsedArticle.content,
        feedProfile,
      );

      if (!articleId) {
        throw new Error('Failed to create article (duplicate or database error)');
      }

      console.log(`Article created with ID: ${articleId}`);

      console.log(`Step 4: Processing article ${articleId}...`);
      const processStats = await this.processorService.processArticles(
        feedProfile,
        1,
        articleId,
      );

      if (processStats.errors > 0 || processStats.articlesProcessed === 0) {
        throw new Error('Failed to process article');
      }

      console.log(`Step 5: Rating article ${articleId}...`);
      const rateStats = await this.processorService.rateArticles(
        feedProfile,
        1,
        articleId,
      );

      if (rateStats.errors > 0 || rateStats.articlesRated === 0) {
        throw new Error('Failed to rate article');
      }

      console.log(`Step 6: Categorizing article ${articleId}...`);
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
        `✓ Markdown article processed successfully (Job ${job.id}, Article ID: ${articleId})`,
      );

      return {
        success: true,
        message: `Markdown article from ${s3Key} processed successfully (Article ID: ${articleId})`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(
        `✗ Failed to process markdown article (Job ${job.id}):`,
        errorMessage,
      );
      throw new Error(
        `Markdown article processing failed for ${s3Key}: ${errorMessage}`,
      );
    }
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
      console.log('Markdown article processor worker closed');
    }
  }
}
