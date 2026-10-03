import {
  ARTICLE_PROCESSING_QUEUE,
  JobInfo,
  MARKDOWN_ARTICLE_PROCESSING_QUEUE,
  PROCESS_ARTICLE_JOB,
  PROCESS_MARKDOWN_ARTICLE_JOB,
} from '@libs/queue';
import { Inject, Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { FeedProfile } from '../../shared/types/feed';

export interface ProcessArticleJobData {
  articleFileKey: string;
  feedProfile: FeedProfile;
  generateAudio?: boolean;
}

export interface ProcessMarkdownArticleJobData {
  s3Bucket: string;
  s3Key: string;
  feedProfile: FeedProfile;
  customPrompt?: string;
  generateAudio?: boolean;
}

/**
 * Enqueues article and markdown processing jobs. Lives in the articles module
 * because both payloads carry a Feed Profile. Markdown retries come from the
 * queue's `defaultJobOptions` in `QueueModule`; article jobs run once.
 */
@Injectable()
export class ArticleJobsService {
  constructor(
    @Inject(ARTICLE_PROCESSING_QUEUE)
    private readonly articleQueue: Queue,
    @Inject(MARKDOWN_ARTICLE_PROCESSING_QUEUE)
    private readonly markdownQueue: Queue,
  ) {}

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

    const job = await this.markdownQueue.add(
      PROCESS_MARKDOWN_ARTICLE_JOB,
      jobData,
    );

    return {
      success: true,
      articleFileKey: s3Key,
      jobId: job.id as string,
      message: 'Markdown article queued for processing',
    };
  }
}
