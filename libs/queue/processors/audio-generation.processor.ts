import { RedisService } from '@libs/redis';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue, Worker } from 'bullmq';
import { GenerateAudioUseCase } from '../../../src/audio-files/usecases/generate-audio.usecase';
import {
  AUDIO_GENERATION_QUEUE
} from '../constants/queue.constants';
import { GenerateAudioJobData } from '../interfaces/audio-job.interface';

type ErrorType = 'retryable' | 'fatal';

interface ErrorClassification {
  type: ErrorType;
  shouldRetry: boolean;
}

@Injectable()
export class AudioGenerationProcessor implements OnModuleInit {
  private worker: Worker;
  private readonly logger = new Logger(AudioGenerationProcessor.name);

  private readonly retryablePatterns = [
    /timeout/i,
    /ETIMEDOUT/i,
    /ECONNRESET/i,
    /ECONNREFUSED/i,
    /rate limit/i,
    /throttl/i,
    /too many requests/i,
    /service unavailable/i,
    /temporarily unavailable/i,
    /network error/i,
    /socket hang up/i,
  ];

  private readonly fatalPatterns = [
    /invalid input/i,
    /missing environment variable/i,
    /authentication failed/i,
    /unauthorized/i,
    /invalid api key/i,
    /malformed/i,
    /validation error/i,
  ];

  constructor(
    private readonly redisService: RedisService,
    private readonly generateAudioUseCase: GenerateAudioUseCase,
    @Inject(AUDIO_GENERATION_QUEUE)
    private readonly audioQueue: Queue,
  ) { }

  onModuleInit() {
    this.worker = new Worker(
      AUDIO_GENERATION_QUEUE,
      async (job: Job<GenerateAudioJobData>) => {
        return await this.processAudioGeneration(job);
      },
      {
        connection: this.redisService.getClient(),
        concurrency: 2, // Process 2 audio jobs in parallel
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log({
        jobId: job.id,
        sourceType: job.data.sourceType,
        sourceId: job.data.sourceId,
        operation: 'process',
        status: 'completed',
      });
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error({
        jobId: job?.id,
        sourceType: job?.data?.sourceType,
        sourceId: job?.data?.sourceId,
        operation: 'process',
        status: 'failed',
        error: err.message,
      });
    });

    this.worker.on('progress', (job, progress) => {
      this.logger.log({
        jobId: job.id,
        sourceType: job.data.sourceType,
        sourceId: job.data.sourceId,
        operation: 'progress',
        progress,
      });
    });

    this.logger.log('Audio generation processor worker initialized');
  }

  /**
   * Process an audio generation job
   * @param job - The BullMQ job containing audio generation data
   * @returns The result of the audio generation
   */
  async processAudioGeneration(
    job: Job<GenerateAudioJobData>,
  ): Promise<{ success: boolean; audioFileId?: string; error?: string }> {
    const { sourceType, sourceId, text, date } = job.data;
    const startTime = Date.now();

    this.logger.log({
      jobId: job.id,
      sourceType,
      sourceId,
      operation: 'start',
      status: 'processing',
    });

    try {
      await job.updateProgress(0);

      if (!text || text.trim().length === 0) {
        throw new Error('Invalid input: text is required and cannot be empty');
      }

      if (!sourceId) {
        throw new Error('Invalid input: sourceId is required');
      }

      if (!sourceType || (sourceType !== 'article' && sourceType !== 'transcription')) {
        throw new Error('Invalid input: sourceType must be "article" or "transcription"');
      }

      await job.updateProgress(25);

      const result = await this.generateAudioUseCase.execute({
        sourceType,
        sourceId,
        text,
        date: date ? new Date(date) : new Date(),
      });

      await job.updateProgress(75);

      const durationMs = Date.now() - startTime;

      if (result.success) {
        await job.updateProgress(100);

        this.logger.log({
          jobId: job.id,
          sourceType,
          sourceId,
          operation: 'complete',
          status: 'success',
          durationMs,
          audioFileId: result.audioFileId,
        });

        return {
          success: true,
          audioFileId: result.audioFileId,
        };
      } else {
        const errorClassification = this.classifyError(result.error || 'Unknown error');

        this.logger.error({
          jobId: job.id,
          sourceType,
          sourceId,
          operation: 'complete',
          status: 'failed',
          durationMs,
          error: result.error,
          errorType: errorClassification.type,
          shouldRetry: errorClassification.shouldRetry,
          attempt: job.attemptsMade + 1,
        });

        if (errorClassification.type === 'fatal') {
          void job.discard();
        }

        return {
          success: false,
          error: result.error,
        };
      }
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      const errorClassification = this.classifyError(errorMessage);

      this.logger.error({
        jobId: job.id,
        sourceType,
        sourceId,
        operation: 'complete',
        status: 'error',
        durationMs,
        error: errorMessage,
        errorType: errorClassification.type,
        shouldRetry: errorClassification.shouldRetry,
        attempt: job.attemptsMade + 1,
      });

      if (errorClassification.type === 'fatal') {
        void job.discard();
      }

      throw error; // Re-throw to trigger BullMQ retry mechanism
    }
  }

  /**
   * Classify an error as retryable or fatal
   * @param errorMessage - The error message to classify
   * @returns Error classification
   */
  private classifyError(errorMessage: string): ErrorClassification {
    for (const pattern of this.fatalPatterns) {
      if (pattern.test(errorMessage)) {
        return { type: 'fatal', shouldRetry: false };
      }
    }

    for (const pattern of this.retryablePatterns) {
      if (pattern.test(errorMessage)) {
        return { type: 'retryable', shouldRetry: true };
      }
    }

    return { type: 'retryable', shouldRetry: true };
  }

  /**
   * Get queue metrics for monitoring
   * @returns Queue metrics
   */
  async getQueueMetrics(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  }> {
    const waiting = await this.audioQueue.getWaitingCount();
    const active = await this.audioQueue.getActiveCount();
    const completed = await this.audioQueue.getCompletedCount();
    const failed = await this.audioQueue.getFailedCount();
    const delayed = await this.audioQueue.getDelayedCount();
    // paused count is not directly available on Queue, default to 0
    const paused = 0;

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused,
    };
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
    }
  }
}
