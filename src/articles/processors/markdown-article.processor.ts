import { AudioJobService } from '@libs/audio';
import { MARKDOWN_ARTICLE_PROCESSING_QUEUE } from '@libs/queue';
import { createWorker } from '@libs/queue/create-worker';
import { S3Service } from '@libs/s3';
import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Job, Queue, Worker } from 'bullmq';
import { enqueueArticleAudio } from '../../processor/enqueue-article-audio';
import { ArticleProcessingPipelineService } from '../../processor/pipeline/article-processing-pipeline.service';
import { ProcessMarkdownArticleJobData } from '../services/article-jobs.service';
import { ArticleIngestionService } from '../ingestion/article-ingestion.service';
import { parseMarkdownArticle } from '../helpers/parse-markdown';
import { MarkdownUploadFailureNotifier } from './markdown-upload-failure.notifier';

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
    @Inject(MARKDOWN_ARTICLE_PROCESSING_QUEUE)
    private readonly queue: Queue,
    private readonly s3Service: S3Service,
    private readonly ingestionService: ArticleIngestionService,
    private readonly pipeline: ArticleProcessingPipelineService,
    private readonly audioJobService: AudioJobService,
    private readonly failureNotifier: MarkdownUploadFailureNotifier,
  ) {}

  onModuleInit() {
    this.worker = createWorker(
      this.queue,
      (job: Job<ProcessMarkdownArticleJobData>) =>
        this.processMarkdownArticle(job),
      {
        logger: this.logger,
        onTerminalFailure: (job, err) =>
          void this.failureNotifier.notify(job, err),
      },
    );

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
