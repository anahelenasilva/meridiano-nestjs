import { EmailService } from '@libs/email';
import { RedisService } from '@libs/redis';
import { Inject, Injectable, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, QueueEvents } from 'bullmq';
import { ConfigService } from '../../src/config/config.service';
import { FeedProfile } from '../../src/shared/types/feed';
import {
  ARTICLE_PROCESSING_QUEUE,
  MARKDOWN_ARTICLE_PROCESSING_QUEUE,
  PROCESS_ARTICLE_JOB,
  PROCESS_MARKDOWN_ARTICLE_JOB,
  PROCESS_TRANSCRIPTION_SUMMARY_JOB,
  YOUTUBE_TRANSCRIPTION_SUMMARY_QUEUE,
} from './constants/queue.constants';
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
  private failureHandler: (({ jobId, failedReason }: { jobId: string; failedReason: string }) => void) | null = null;

  constructor(
    @Inject(ARTICLE_PROCESSING_QUEUE)
    private readonly articleQueue: Queue,
    @Inject(MARKDOWN_ARTICLE_PROCESSING_QUEUE)
    private readonly markdownArticleQueue: Queue,
    @Inject(YOUTUBE_TRANSCRIPTION_SUMMARY_QUEUE)
    private readonly transcriptionSummaryQueue: Queue,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly redisService: RedisService,
  ) {
    this.markdownQueueEvents = new QueueEvents(MARKDOWN_ARTICLE_PROCESSING_QUEUE, {
      connection: this.redisService.getClient(),
    });
  }

  onModuleInit() {
    this.setupMarkdownArticleFailureHandler();
  }

  async onModuleDestroy() {
    if (this.failureHandler) {
      this.markdownQueueEvents.off('failed', this.failureHandler);
      this.failureHandler = null;
    }
    await this.markdownQueueEvents.close();
  }

  private setupMarkdownArticleFailureHandler() {
    this.failureHandler = ({ jobId, failedReason }: { jobId: string; failedReason: string }) => {
      void this.handleMarkdownArticleFailure(jobId, failedReason);
    };
    this.markdownQueueEvents.on('failed', this.failureHandler);
  }

  private isValidMarkdownArticleJobData(data: unknown): data is ProcessMarkdownArticleJobData {
    return (
      data !== null &&
      typeof data === 'object' &&
      's3Bucket' in data &&
      's3Key' in data &&
      typeof (data as { s3Bucket: unknown }).s3Bucket === 'string' &&
      typeof (data as { s3Key: unknown }).s3Key === 'string'
    );
  }

  private async handleMarkdownArticleFailure(jobId: string, failedReason: string): Promise<void> {
    try {
      const job = await this.markdownArticleQueue.getJob(jobId);

      if (!job) {
        return;
      }

      const attemptsMade = job.attemptsMade;

      if (attemptsMade >= 3) {
        const { failureNotificationEmail, failureNotificationEmailFrom } = this.configService.getArticleEmailsNotifications();

        if (!failureNotificationEmail || !failureNotificationEmailFrom) {
          console.warn(`Job ${job.id} failed after 3 attempts, but no notification email is configured failureNotificationEmail or failureNotificationEmailFrom`);
          return;
        }

        const jobData = job.data;

        if (!this.isValidMarkdownArticleJobData(jobData)) {
          console.error(`Job ${job.id} has invalid data structure. Expected ProcessMarkdownArticleJobData but got:`, jobData);
          return;
        }

        const { s3Bucket, s3Key } = jobData;
        const errorMessage = failedReason || 'Unknown error';
        const timestamp = new Date().toISOString();

        try {
          await this.emailService.sendEmail({
            from: failureNotificationEmailFrom,
            to: failureNotificationEmail,
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

          console.log(`Failure notification email sent to ${failureNotificationEmail} for job ${job.id}`);
        } catch (emailError) {
          console.error(`Failed to send notification email for job ${job.id}:`, emailError);
        }

      }
    } catch (error) {
      console.error('Error in markdown article failure handler:', error);
    }
  }

  /**
   * Add an article to the processing queue
   * @param articleFileKey - The ID of the article to process
   * @param feedProfile - The feed profile for the article
   * @returns Job information including job ID
   */
  async addArticleProcessingJob(
    articleFileKey: string,
    feedProfile: FeedProfile,
  ): Promise<JobInfo> {
    const jobData: ProcessArticleJobData = {
      articleFileKey,
      feedProfile,
    };

    const job = await this.articleQueue.add(PROCESS_ARTICLE_JOB, jobData);

    return {
      success: true,
      articleFileKey,
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
    generateAudio?: boolean,
  ): Promise<JobInfo> {
    const jobData: ProcessTranscriptionSummaryJobData = {
      transcriptionId,
      transcriptText,
      videoTitle,
      generateAudio,
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
