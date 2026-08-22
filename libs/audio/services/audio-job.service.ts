import {
  AUDIO_GENERATION_QUEUE,
  GENERATE_AUDIO_JOB,
} from '@libs/queue';
import { RedisService } from '@libs/redis';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import {
  AudioJobDescriptor,
  AudioJobStatus,
  EnqueueOptions,
  GenerateAudioJobData,
  JobInfo,
} from '../interfaces/audio-job.interface';

@Injectable()
export class AudioJobService {
  private readonly logger = new Logger(AudioJobService.name);
  private readonly enqueueLockTtlSeconds = 60;

  constructor(
    @Inject(AUDIO_GENERATION_QUEUE)
    private readonly audioQueue: Queue,
    private readonly redisService: RedisService,
  ) { }

  async hasPendingAudioJob(
    sourceType: 'article' | 'transcription',
    sourceId: string,
  ): Promise<boolean> {
    try {
      const jobs = await this.audioQueue.getJobs([
        'waiting',
        'active',
        'delayed',
        'paused',
      ]);

      return jobs.some((job) => {
        const data = job.data as GenerateAudioJobData;
        return data.sourceType === sourceType && data.sourceId === sourceId;
      });
    } catch (error) {
      this.logger.error({
        operation: 'hasPendingAudioJob',
        sourceType,
        sourceId,
        error: error instanceof Error ? error.message : String(error),
        errorObject: error,
      });
      return false;
    }
  }

  async enqueueAudioJobIfNotDuplicate(
    data: GenerateAudioJobData,
    options?: EnqueueOptions,
  ): Promise<JobInfo | AudioJobStatus | null> {
    const lockKey = `audio:enqueue-lock:${data.sourceType}:${data.sourceId}`;
    const lockAcquired = await this.redisService.getClient().set(
      lockKey,
      '1',
      'EX',
      this.enqueueLockTtlSeconds,
      'NX',
    );

    if (!lockAcquired) {
      return null;
    }

    try {
      const hasPendingJob = await this.hasPendingAudioJob(
        data.sourceType,
        data.sourceId,
      );

      if (hasPendingJob) {
        return null;
      }

      return await this.enqueueAudioJob(data, options);
    } finally {
      await this.redisService.getClient().del(lockKey);
    }
  }

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
    sourceType: 'article' | 'transcription',
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
   * List in-flight and recently-failed audio generation jobs, keyed by source,
   * from a single queue scan. Backs GET /api/audio/jobs. Completed jobs are
   * deliberately excluded: has_audio (the DB row) is the durable source of
   * truth for "audio exists", so echoing completed from Redis too would be a
   * second, driftable source of the same fact.
   * @returns Source-keyed job descriptors for waiting/active/delayed/paused/failed jobs
   */
  async listActiveAndFailedJobs(): Promise<AudioJobDescriptor[]> {
    try {
      const jobs = await this.audioQueue.getJobs([
        'waiting',
        'active',
        'delayed',
        'paused',
        'failed',
      ]);

      const descriptors = await Promise.all(
        jobs.map((job) => this.mapJobToDescriptor(job)),
      );

      return descriptors.filter(
        (descriptor): descriptor is AudioJobDescriptor => descriptor !== null,
      );
    } catch (error) {
      this.logger.error({
        operation: 'listActiveAndFailedJobs',
        error: error instanceof Error ? error.message : String(error),
        errorObject: error,
      });
      return [];
    }
  }

  /**
   * Map a BullMQ job to an AudioJobDescriptor, or null if the job turns out to
   * be completed (defensive; the scan in listActiveAndFailedJobs already
   * excludes 'completed', but state can change between getJobs and getState).
   * @param job - The BullMQ job
   * @returns The audio job descriptor, or null to omit the job
   */
  private async mapJobToDescriptor(
    job: Job,
  ): Promise<AudioJobDescriptor | null> {
    const data = job.data as GenerateAudioJobData;
    const bullState = await job.getState();

    if (bullState === 'completed') {
      return null;
    }

    let state: 'queued' | 'generating' | 'failed';
    if (bullState === 'active') {
      state = 'generating';
    } else if (bullState === 'failed') {
      state = 'failed';
    } else {
      // BullMQ's JobState type has no 'paused' member: a job in a paused queue
      // still reports 'waiting' via getState(). This branch also covers
      // 'delayed', 'prioritized' and 'waiting-children', which are all
      // "not started yet" from the caller's perspective.
      state = 'queued';
    }

    return {
      source_type: data.sourceType,
      source_id: data.sourceId,
      state,
      error: state === 'failed' ? job.failedReason ?? null : null,
    };
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
