import { EmailService } from '@libs/email';
import { RedisService } from '@libs/redis';
import { Inject, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, QueueEvents } from 'bullmq';
import { ConfigService } from '../../src/config/config.service';
import { FeedProfile } from '../../src/shared/types/feed';
import {
  ARTICLE_PROCESSING_QUEUE,
  AUDIO_GENERATION_QUEUE,
  CUSTOM_BRIEFING_GENERATION_QUEUE,
  GENERATE_CUSTOM_BRIEFING_JOB,
  MARKDOWN_ARTICLE_PROCESSING_QUEUE,
  PROCESS_ARTICLE_JOB,
  PROCESS_MARKDOWN_ARTICLE_JOB,
  PROCESS_TRANSCRIPTION_SUMMARY_JOB,
  YOUTUBE_TRANSCRIPTION_SUMMARY_QUEUE,
} from './constants/queue.constants';
import type { ProcessArticleJobData } from './interfaces/article-job.interface';
import type { GenerateAudioJobData } from './interfaces/audio-job.interface';
import type { CustomBriefingJobData } from './interfaces/custom-briefing-job.interface';
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
  private audioQueueEvents: QueueEvents;
  private markdownFailureHandler: (({ jobId, failedReason }: { jobId: string; failedReason: string }) => void) | null = null;
  private audioFailureHandler: (({ jobId, failedReason }: { jobId: string; failedReason: string }) => void) | null = null;
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @Inject(ARTICLE_PROCESSING_QUEUE)
    private readonly articleQueue: Queue,
    @Inject(MARKDOWN_ARTICLE_PROCESSING_QUEUE)
    private readonly markdownArticleQueue: Queue,
    @Inject(YOUTUBE_TRANSCRIPTION_SUMMARY_QUEUE)
    private readonly transcriptionSummaryQueue: Queue,
    @Inject(AUDIO_GENERATION_QUEUE)
    private readonly audioQueue: Queue,
    @Inject(CUSTOM_BRIEFING_GENERATION_QUEUE)
    private readonly customBriefingQueue: Queue,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly redisService: RedisService,
  ) {
    this.markdownQueueEvents = new QueueEvents(MARKDOWN_ARTICLE_PROCESSING_QUEUE, {
      connection: this.redisService.getClient(),
    });
    this.audioQueueEvents = new QueueEvents(AUDIO_GENERATION_QUEUE, {
      connection: this.redisService.getClient(),
    });
  }

  onModuleInit() {
    this.setupMarkdownArticleFailureHandler();
    this.setupAudioGenerationFailureHandler();
  }

  async onModuleDestroy() {
    if (this.markdownFailureHandler) {
      this.markdownQueueEvents.off('failed', this.markdownFailureHandler);
      this.markdownFailureHandler = null;
    }
    await this.markdownQueueEvents.close();
    if (this.audioFailureHandler) {
      this.audioQueueEvents.off('failed', this.audioFailureHandler);
      this.audioFailureHandler = null;
    }
    await this.audioQueueEvents.close();
  }

  private setupMarkdownArticleFailureHandler() {
    this.markdownFailureHandler = ({ jobId, failedReason }: { jobId: string; failedReason: string }) => {
      void this.handleMarkdownArticleFailure(jobId, failedReason);
    };
    this.markdownQueueEvents.on('failed', this.markdownFailureHandler);
  }

  private setupAudioGenerationFailureHandler() {
    this.audioFailureHandler = ({ jobId, failedReason }: { jobId: string; failedReason: string }) => {
      void this.handleAudioGenerationFailure(jobId, failedReason);
    };
    this.audioQueueEvents.on('failed', this.audioFailureHandler);
  }

  private isValidAudioJobData(data: unknown): data is GenerateAudioJobData {
    if (data === null || typeof data !== 'object') return false;
    const d = data as Record<string, unknown>;
    const date = d.date;
    const isValidDate = date instanceof Date || (typeof date === 'string' && !Number.isNaN(Date.parse(date)));
    return (
      typeof d.sourceType === 'string' &&
      typeof d.sourceId === 'string' &&
      typeof d.text === 'string' &&
      'date' in d &&
      isValidDate
    );
  }

  private async handleAudioGenerationFailure(jobId: string, failedReason: string): Promise<void> {
    try {
      const job = await this.audioQueue.getJob(jobId);

      if (!job) {
        return;
      }

      const attemptsMade = job.attemptsMade;
      const maxAttempts = job.opts.attempts ?? 3;

      if (attemptsMade >= maxAttempts) {
        const config = this.configService.getAudioFailureNotificationEmail();

        if (!config) {
          this.logger.warn(
            `Audio job ${job.id} failed after ${maxAttempts} attempts, but AUDIO_FAILURE_SUPPORT_EMAIL (and AUDIO_FAILURE_SUPPORT_EMAIL_FROM or ARTICLE_FAILURE_NOTIFICATION_EMAIL_FROM) is not configured.`,
          );
          return;
        }

        const jobData = job.data;

        if (!this.isValidAudioJobData(jobData)) {
          this.logger.error(
            `Audio job ${job.id} has invalid data structure. Expected GenerateAudioJobData but got:`,
            jobData,
          );
          return;
        }

        const { sourceType, sourceId } = jobData;
        const errorMessage = failedReason || 'Unknown error';
        const timestamp = new Date().toISOString();

        try {
          await this.emailService.sendEmail({
            from: config.from,
            to: config.to,
            subject: 'Audio Generation Failed',
            text: `Audio generation job failed after ${maxAttempts} attempts.

Details:
- Job ID: ${job.id}
- Source Type: ${sourceType}
- Source ID: ${sourceId}
- Error: ${errorMessage}
- Timestamp: ${timestamp}

Please investigate the issue.`,
          });

          this.logger.log(`Audio failure notification email sent to ${config.to} for job ${job.id}`);
        } catch (emailError) {
          this.logger.error(
            `Failed to send audio failure notification email for job ${job.id}:`,
            emailError instanceof Error ? emailError.message : String(emailError),
          );
        }
      }
    } catch (error) {
      this.logger.error(
        'Error in audio generation failure handler:',
        error instanceof Error ? error.message : String(error),
      );
    }
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
    generateAudio?: boolean,
  ): Promise<JobInfo> {
    const jobData: ProcessArticleJobData = {
      articleFileKey,
      feedProfile,
      generateAudio,
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
    customPrompt?: string,
    generateAudio?: boolean,
  ): Promise<JobInfo> {
    const jobData: ProcessMarkdownArticleJobData = {
      s3Bucket,
      s3Key,
      feedProfile,
      customPrompt,
      generateAudio,
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
   * @param generateAudio - Whether to generate audio after summary
   * @param channelId - The YouTube channel ID for processing mode selection
   * @returns Job information including job ID
   */
  async addTranscriptionSummaryJob(
    transcriptionId: string,
    transcriptText: string,
    videoTitle: string,
    generateAudio?: boolean,
    channelId?: string,
  ): Promise<JobInfo> {
    const jobData: ProcessTranscriptionSummaryJobData = {
      transcriptionId,
      transcriptText,
      videoTitle,
      generateAudio,
      channelId,
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

  async addCustomBriefingJob(
    data: CustomBriefingJobData,
  ): Promise<{ jobId: string }> {
    const { attempts, backoffDelayMs } =
      this.configService.getCustomBriefingQueueConfig();
    const job = await this.customBriefingQueue.add(
      GENERATE_CUSTOM_BRIEFING_JOB,
      data,
      {
        attempts,
        backoff: {
          type: 'exponential',
          delay: backoffDelayMs,
        },
      },
    );
    return { jobId: job.id as string };
  }

  async getCustomBriefingJobStatus(jobId: string): Promise<JobStatus> {
    const job = await this.customBriefingQueue.getJob(jobId);

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
