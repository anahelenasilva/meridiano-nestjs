import {
  AUDIO_GENERATION_QUEUE,
  GENERATE_AUDIO_JOB,
} from '@libs/queue';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import {
  AudioJobStatus,
  EnqueueOptions,
  GenerateAudioJobData,
  JobInfo,
} from '../interfaces/audio-job.interface';

@Injectable()
export class AudioJobService {
  private readonly logger = new Logger(AudioJobService.name);

  constructor(
    @Inject(AUDIO_GENERATION_QUEUE)
    private readonly audioQueue: Queue,
  ) { }

  /**
   * Enqueue an audio generation job
   * @param data - The audio generation job data
   * @param options - Optional enqueue options
   * @returns JobInfo or AudioJobStatus if waitForCompletion is true
   */
  async enqueueAudioJob(
    data: GenerateAudioJobData,
    options?: EnqueueOptions,
  ): Promise<JobInfo | AudioJobStatus> {
    try {
      const job = await this.audioQueue.add(GENERATE_AUDIO_JOB, data, {
        priority: options?.priority,
        delay: options?.delay,
      });

      const jobId = String(job.id);

      this.logger.log({
        jobId,
        sourceType: data.sourceType,
        sourceId: data.sourceId,
        operation: 'enqueue',
        status: 'queued',
      });

      // Fire-and-forget mode (default)
      if (!options?.waitForCompletion) {
        return { jobId, status: 'queued' };
      }

      // Synchronous mode for backward compatibility
      // Poll for job completion since waitUntilCompleted is not available
      const DEFAULT_TIMEOUT_MS = 60000; // 1 minute default
      const timeoutMs = options.timeout || DEFAULT_TIMEOUT_MS;
      const pollIntervalMs = 500;
      const startTime = Date.now();

      while (Date.now() - startTime < timeoutMs) {
        const currentJob = await this.audioQueue.getJob(jobId);
        if (!currentJob) {
          throw new Error(`Job ${jobId} not found`);
        }

        const state = await currentJob.getState();
        if (state === 'completed') {
          return this.mapJobToStatus(currentJob);
        }
        if (state === 'failed') {
          return this.mapJobToStatus(currentJob);
        }

        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }

      throw new Error(`Timeout waiting for job ${jobId} to complete`);
    } catch (error) {
      this.logger.error({
        operation: 'enqueue',
        sourceType: data.sourceType,
        sourceId: data.sourceId,
        error: error instanceof Error ? error.message : String(error),
        errorObject: error,
      });
      throw error;
    }
  }

  /**
   * Get the status of a job by ID
   * @param jobId - The job ID
   * @returns The job status
   */
  async getJobStatus(jobId: string): Promise<AudioJobStatus | null> {
    try {
      const job = await this.audioQueue.getJob(jobId);

      if (!job) {
        return null;
      }

      return await this.mapJobToStatus(job);
    } catch (error) {
      this.logger.error({
        operation: 'status',
        jobId,
        error: error instanceof Error ? error.message : String(error),
        errorObject: error,
      });
      return null;
    }
  }

  /**
   * Get jobs by source type and source ID
   * @param sourceType - The source type ('article' | 'transcription')
   * @param sourceId - The source ID
   * @returns Array of matching job statuses
   */
  async getJobsBySource(
    sourceType: string,
    sourceId: string,
  ): Promise<AudioJobStatus[]> {
    try {
      const jobs = await this.audioQueue.getJobs(['waiting', 'active', 'completed', 'failed', 'delayed', 'paused']);

      const matchingJobs = jobs.filter((job) => {
        const data = job.data as GenerateAudioJobData;
        return data.sourceType === sourceType && data.sourceId === sourceId;
      });

      return Promise.all(matchingJobs.map((job) => this.mapJobToStatus(job)));
    } catch (error) {
      this.logger.error({
        operation: 'list',
        sourceType,
        sourceId,
        error: error instanceof Error ? error.message : String(error),
        errorObject: error,
      });
      return [];
    }
  }

  /**
   * Cancel a pending job
   * @param jobId - The job ID to cancel
   * @returns true if cancelled, false otherwise
   */
  async cancelJob(jobId: string): Promise<boolean> {
    try {
      const job = await this.audioQueue.getJob(jobId);

      if (!job) {
        this.logger.warn({
          jobId,
          operation: 'cancel',
          status: 'not_found',
        });
        return false;
      }

      const state = await job.getState();

      if (state !== 'waiting' && state !== 'delayed') {
        this.logger.warn({
          jobId,
          operation: 'cancel',
          status: 'invalid_state',
          currentState: state,
        });
        return false;
      }

      await job.remove();

      this.logger.log({
        jobId,
        operation: 'cancel',
        status: 'cancelled',
      });

      return true;
    } catch (error) {
      this.logger.error({
        operation: 'cancel',
        jobId,
        error: error instanceof Error ? error.message : String(error),
        errorObject: error,
      });
      return false;
    }
  }

  /**
   * Map a BullMQ job to AudioJobStatus
   * @param job - The BullMQ job
   * @returns The audio job status
   */
  private async mapJobToStatus(job: Job): Promise<AudioJobStatus> {
    const data = job.data as GenerateAudioJobData;
    const returnValue = job.returnvalue;
    const failedReason = job.failedReason;
    const state = await job.getState();

    let status: 'completed' | 'failed' | 'unknown';
    if (state === 'completed') {
      status = 'completed';
    } else if (state === 'failed' || failedReason) {
      status = 'failed';
    } else {
      status = 'unknown';
    }

    return {
      jobId: String(job.id),
      state: status,
      progress: (job.progress as number) || 0,
      result: returnValue,
      error: failedReason,
      data,
    };
  }
}
