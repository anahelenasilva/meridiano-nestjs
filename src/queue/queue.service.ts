import { Inject, Injectable, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, QueueEvents } from 'bullmq';
import { ConfigService } from '../config/config.service';
import { EmailService } from '../email/email.service';
import { FeedProfile } from '../shared/types/feed';
import {
  ARTICLE_PROCESSING_QUEUE,
  MARKDOWN_ARTICLE_PROCESSING_QUEUE,
  PROCESS_ARTICLE_JOB,
  PROCESS_MARKDOWN_ARTICLE_JOB,
  PROCESS_TRANSCRIPTION_SUMMARY_JOB,
  YOUTUBE_TRANSCRIPTION_SUMMARY_QUEUE,
} from '../shared/types/queue.constants';
import type { ProcessArticleJobData } from './interfaces/article-job.interface';
import type { ProcessMarkdownArticleJobData } from './interfaces/markdown-article-job.interface';
import type { ProcessTranscriptionSummaryJobData } from './interfaces/youtube-transcription-job.interface';

export interface JobInfo {
  success: boolean;
  jobId: string;
  articleFileKey: string;
  message: string;
}

export interface JobStatus {
  jobId: string;
  state: string;
  progress: string | boolean | number | object;
  result: any;
  error: string | undefined;
  data: any;
}

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private markdownQueueEvents: QueueEvents;

  constructor(
    @Inject(ARTICLE_PROCESSING_QUEUE)
    private readonly articleQueue: Queue,
    @Inject(MARKDOWN_ARTICLE_PROCESSING_QUEUE)
    private readonly markdownArticleQueue: Queue,
    @Inject(YOUTUBE_TRANSCRIPTION_SUMMARY_QUEUE)
    private readonly transcriptionSummaryQueue: Queue,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {
    this.markdownQueueEvents = new QueueEvents(MARKDOWN_ARTICLE_PROCESSING_QUEUE, {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    });
  }

  onModuleInit() {
    this.setupMarkdownArticleFailureHandler();
  }

  async onModuleDestroy() {
    await this.markdownQueueEvents.close();
  }

  private setupMarkdownArticleFailureHandler() {
    this.markdownQueueEvents.on('failed', ({ jobId, failedReason }: { jobId: string; failedReason: string }) => {
      void this.handleMarkdownArticleFailure(jobId, failedReason);
    });
  }

  private async handleMarkdownArticleFailure(jobId: string, failedReason: string): Promise<void> {
    try {
      const job = await this.markdownArticleQueue.getJob(jobId);

      if (!job) {
        return;
      }

      const attemptsMade = job.attemptsMade;

      if (attemptsMade >= 3) {
        const notificationEmail = this.configService.getArticleFailureNotificationEmail();

        if (notificationEmail) {
          const { s3Bucket, s3Key } = job.data as ProcessMarkdownArticleJobData;
          const errorMessage = failedReason || 'Unknown error';
          const timestamp = new Date().toISOString();

          try {
            await this.emailService.sendEmail({
              from: 'noreply@meridiano.com',
              to: notificationEmail,
              subject: 'Article Processing Failed',
              text: `Article processing failed after 3 attempts.

Details:
- S3 Bucket: ${s3Bucket}
- S3 Key: ${s3Key}
- Job ID: ${job.id}
- Error: ${errorMessage}
- Timestamp: ${timestamp}

Please investigate the issue.`,
            });

            console.log(`Failure notification email sent to ${notificationEmail} for job ${job.id}`);
          } catch (emailError) {
            console.error(`Failed to send notification email for job ${job.id}:`, emailError);
          }
        } else {
          console.warn(`Job ${job.id} failed after 3 attempts, but no notification email is configured`);
        }
      }
    } catch (error) {
      console.error('Error in markdown article failure handler:', error);
    }
  }

  /**
   * Add an article to the processing queue
   * @param articleId - The ID of the article to process
   * @param feedProfile - The feed profile for the article
   * @returns Job information including job ID
   */
  async addArticleProcessingJob(
    articleId: string,
    feedProfile: FeedProfile,
  ): Promise<JobInfo> {
    const jobData: ProcessArticleJobData = {
      articleId,
      feedProfile,
    };

    const job = await this.articleQueue.add(PROCESS_ARTICLE_JOB, jobData);

    return {
      success: true,
      articleFileKey: articleId,
      jobId: job.id as string,
      message: 'Article queued for processing',
    };
  }

  /**
   * Add a markdown article processing job to the queue
   * @param s3Bucket - The S3 bucket name
   * @param s3Key - The S3 key
   * @param feedProfile - The feed profile for the article
   * @returns Job information including job ID
   */
  async addMarkdownArticleProcessingJob(
    s3Bucket: string,
    s3Key: string,
    feedProfile: FeedProfile,
  ): Promise<JobInfo> {
    const jobData: ProcessMarkdownArticleJobData = {
      s3Bucket,
      s3Key,
      feedProfile,
    };

    const job = await this.markdownArticleQueue.add(
      PROCESS_MARKDOWN_ARTICLE_JOB,
      jobData,
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    );

    return {
      success: true,
      articleFileKey: s3Key,
      jobId: job.id as string,
      message: 'Markdown article queued for processing',
    };
  }

  /**
   * Add a transcription summary job to the queue
   * @param transcriptionId - The ID of the transcription
   * @param transcriptText - The transcript text to summarize
   * @param videoTitle - The video title (for logging)
   * @returns Job information including job ID
   */
  async addTranscriptionSummaryJob(
    transcriptionId: string,
    transcriptText: string,
    videoTitle: string,
  ): Promise<JobInfo> {
    const jobData: ProcessTranscriptionSummaryJobData = {
      transcriptionId,
      transcriptText,
      videoTitle,
    };

    const job = await this.transcriptionSummaryQueue.add(
      PROCESS_TRANSCRIPTION_SUMMARY_JOB,
      jobData,
    );

    return {
      success: true,
      articleFileKey: transcriptionId,
      jobId: job.id as string,
      message: 'Transcription summary queued for processing',
    };
  }

  /**
   * Get the status of a job by its ID
   * @param jobId - The ID of the job
   * @returns Job status information
   * @throws NotFoundException if job is not found
   */
  async getJobStatus(jobId: string): Promise<JobStatus> {
    const job = await this.articleQueue.getJob(jobId);

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    const state = await job.getState();
    const progress = job.progress;
    const returnValue = job.returnvalue;
    const failedReason = job.failedReason;

    return {
      jobId: job.id as string,
      state,
      progress,
      result: returnValue,
      error: failedReason,
      data: job.data,
    };
  }
}
