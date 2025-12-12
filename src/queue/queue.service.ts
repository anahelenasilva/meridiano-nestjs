import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { FeedProfile } from '../shared/types/feed';
import {
  ARTICLE_PROCESSING_QUEUE,
  PROCESS_ARTICLE_JOB,
} from '../shared/types/queue.constants';
import type { ProcessArticleJobData } from './interfaces/article-job.interface';

export interface JobInfo {
  success: boolean;
  jobId: string;
  articleId: number;
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
export class QueueService {
  constructor(
    @Inject(ARTICLE_PROCESSING_QUEUE)
    private readonly articleQueue: Queue,
  ) { }

  /**
   * Add an article to the processing queue
   * @param articleId - The ID of the article to process
   * @param feedProfile - The feed profile for the article
   * @returns Job information including job ID
   */
  async addArticleProcessingJob(
    articleId: number,
    feedProfile: FeedProfile,
  ): Promise<JobInfo> {
    const jobData: ProcessArticleJobData = {
      articleId,
      feedProfile,
    };

    const job = await this.articleQueue.add(PROCESS_ARTICLE_JOB, jobData);

    return {
      success: true,
      articleId,
      jobId: job.id as string,
      message: 'Article queued for processing',
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
