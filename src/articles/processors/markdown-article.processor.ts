import { AudioJobService } from '@libs/audio';
import {
  MARKDOWN_ARTICLE_PROCESSING_QUEUE,
  ProcessMarkdownArticleJobData,
} from '@libs/queue';
import { RedisService } from '@libs/redis';
import { S3Service } from '@libs/s3';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { enqueueArticleAudio } from '../../processor/enqueue-article-audio';
import { ArticleProcessingPipelineService } from '../../processor/pipeline/article-processing-pipeline.service';
import { ArticleIngestionService } from '../ingestion/article-ingestion.service';
import { parseMarkdownArticle } from '../helpers/parse-markdown';

/**
 * Bull worker for uploaded markdown: download from S3 -> parse -> ingest (which
 * runs ADR-0003 Article Source extraction before save) -> run the saved Article
 * through the {@link ArticleProcessingPipelineService}.
 */
@Injectable()
export class MarkdownArticleProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MarkdownArticleProcessor.name);
  private worker: Worker;

  constructor(
    private readonly redisService: RedisService,
    private readonly s3Service: S3Service,
    private readonly ingestionService: ArticleIngestionService,
    private readonly pipeline: ArticleProcessingPipelineService,
    private readonly audioJobService: AudioJobService,
  ) {}

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

    // Handle connection errors during shutdown to prevent ECONNRESET from crashing tests
    this.worker.on('error', (err: Error) => {
      // Suppress ECONNRESET errors during shutdown - these are expected when Redis connection closes
      if (
        err.message?.includes('ECONNRESET') ||
        err.message?.includes('closed')
      ) {
        return;
      }
      console.error('Markdown article processor worker error:', err);
    });

    console.log('Markdown article processor worker initialized');
  }

  async processMarkdownArticle(
    job: Job<ProcessMarkdownArticleJobData>,
  ): Promise<{ success: boolean; message: string }> {
    const { s3Bucket, s3Key, feedProfile, customPrompt, generateAudio } =
      job.data;

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
      const article = await this.ingestionService.ingest({
        url: `s3://${s3Bucket}/${s3Key}`,
        title: parsedArticle.title,
        publishedDate: parsedArticle.publishedDate,
        content: parsedArticle.content,
        feedProfile,
        source: { type: 'markdown' },
        customPrompt,
      });

      const articleId = article.id;
      console.log(`Article created with ID: ${articleId}`);

      console.log(
        `Step 4: Running article ${articleId} through the pipeline...`,
      );
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

      console.log(
        `✓ Markdown article processed successfully (Job ${job.id}, Article ID: ${articleId})`,
      );

      return {
        success: true,
        message: `Markdown article from ${s3Key} processed successfully (Article ID: ${articleId})`,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
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
