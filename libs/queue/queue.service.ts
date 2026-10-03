import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ConfigService } from '../../src/config/config.service';
import { FeedProfile } from '../../src/shared/types/feed';
import {
  ARTICLE_PROCESSING_QUEUE,
  BACKUP_TRANSCRIPT_JOB,
  CUSTOM_BRIEFING_GENERATION_QUEUE,
  GENERATE_CUSTOM_BRIEFING_JOB,
  INGEST_TRANSCRIPT_JOB,
  PROCESS_TRANSCRIPTION_SUMMARY_JOB,
  TRANSCRIPT_BACKUP_QUEUE,
  YOUTUBE_TRANSCRIPT_INGEST_QUEUE,
  YOUTUBE_TRANSCRIPTION_SUMMARY_QUEUE,
} from './constants/queue.constants';
import type { CustomBriefingJobData } from './interfaces/custom-briefing-job.interface';
import type { BackupTranscriptJobData } from './interfaces/transcript-backup-job.interface';
import type { IngestTranscriptJobData } from './interfaces/transcript-ingest-job.interface';
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
export class QueueService {
  constructor(
    @Inject(ARTICLE_PROCESSING_QUEUE)
    private readonly articleQueue: Queue,
    @Inject(YOUTUBE_TRANSCRIPTION_SUMMARY_QUEUE)
    private readonly transcriptionSummaryQueue: Queue,
    @Inject(CUSTOM_BRIEFING_GENERATION_QUEUE)
    private readonly customBriefingQueue: Queue,
    @Inject(YOUTUBE_TRANSCRIPT_INGEST_QUEUE)
    private readonly transcriptIngestQueue: Queue,
    @Inject(TRANSCRIPT_BACKUP_QUEUE)
    private readonly transcriptBackupQueue: Queue,
    private readonly configService: ConfigService,
  ) {}

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
   * Enqueue a best-effort backup of an on-disk transcript JSON file to S3.
   * Retry/backoff/retention come from the queue's default job options.
   */
  async addTranscriptBackupJob(
    data: BackupTranscriptJobData,
  ): Promise<{ jobId: string }> {
    const job = await this.transcriptBackupQueue.add(
      BACKUP_TRANSCRIPT_JOB,
      data,
    );

    return { jobId: job.id as string };
  }

  /**
   * Queue one video URL for ingest. The job id is derived from the channel and
   * video, so re-submitting a URL that is still live (waiting, active or
   * delayed) is a no-op: BullMQ drops the duplicate id. A job that already
   * failed is removed first, because its Redis key survives (`removeOnFail`
   * is false so the failure strip can show it) and would otherwise swallow
   * the enqueue. Clearing it makes re-pasting the URL a real retry.
   *
   * The two parts are joined with `__` because BullMQ rejects a custom job id
   * containing `:` (it is the separator in its own Redis keys). Nothing parses
   * the id back apart, so the separator only has to be collision-free.
   */
  async addTranscriptIngestJob(
    data: IngestTranscriptJobData,
    videoId: string,
  ): Promise<string> {
    const jobId = `${data.channelDbId}__${videoId}`;

    const existing = await this.transcriptIngestQueue.getJob(jobId);
    if (existing && (await existing.isFailed())) {
      await existing.remove();
    }

    const job = await this.transcriptIngestQueue.add(
      INGEST_TRANSCRIPT_JOB,
      data,
      { jobId },
    );

    return job.id as string;
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
