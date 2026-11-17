import { AUDIO_GENERATION_QUEUE } from '@libs/queue';
import { createWorker } from '@libs/queue/create-worker';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue, UnrecoverableError, Worker } from 'bullmq';
import { Effect, Either } from 'effect';
import { GenerateAudioUseCase } from '../usecases/generate-audio.usecase';
import type { GenerateAudioError } from '../usecases/generate-audio.usecase';
import type { GenerateAudioJobData } from '@libs/audio';
import { AudioGenerationFailureNotifier } from './audio-generation-failure.notifier';

// Whether BullMQ should spend another attempt on each failure. `satisfies` fails
// the build when the use case gains a failure this table does not sort.
const RETRYABLE = {
  RateLimited: true,
  ProviderUnreachable: true,
  ProviderTimeout: true,
  ProviderUnavailable: true,
  ProviderRejected: false,
  ProviderNotConfigured: false,
  StorageNotConfigured: false,
  AudioUploadFailed: true,
  AudioRecordNotSaved: true,
} satisfies Record<GenerateAudioError['_tag'], boolean>;

function failureMessage(error: GenerateAudioError): string {
  if (error.message) return `${error._tag}: ${error.message}`;
  const cause = error.cause;
  return `${error._tag}: ${cause instanceof Error ? cause.message : String(cause)}`;
}

function findInvalidInput({
  sourceType,
  sourceId,
  text,
}: GenerateAudioJobData): string | null {
  if (!text || text.trim().length === 0) {
    return 'Invalid input: text is required and cannot be empty';
  }
  if (!sourceId) {
    return 'Invalid input: sourceId is required';
  }
  if (sourceType !== 'article' && sourceType !== 'transcription') {
    return 'Invalid input: sourceType must be "article" or "transcription"';
  }
  return null;
}

@Injectable()
export class AudioGenerationProcessor implements OnModuleInit {
  private worker: Worker;
  private readonly logger = new Logger(AudioGenerationProcessor.name);

  constructor(
    private readonly generateAudioUseCase: GenerateAudioUseCase,
    @Inject(AUDIO_GENERATION_QUEUE)
    private readonly audioQueue: Queue,
    private readonly failureNotifier: AudioGenerationFailureNotifier,
  ) {}

  onModuleInit() {
    this.worker = createWorker(
      this.audioQueue,
      (job: Job<GenerateAudioJobData>) => this.processAudioGeneration(job),
      {
        logger: this.logger,
        concurrency: 2,
        onTerminalFailure: (job, err) =>
          void this.failureNotifier.notify(job, err),
      },
    );

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

  async processAudioGeneration(
    job: Job<GenerateAudioJobData>,
  ): Promise<{ success: true; audioFileId: string }> {
    const { sourceType, sourceId, text, date } = job.data;
    const startTime = Date.now();

    this.logger.log({
      jobId: job.id,
      sourceType,
      sourceId,
      operation: 'start',
      status: 'processing',
    });

    await job.updateProgress(0);

    const invalidInput = findInvalidInput(job.data);
    if (invalidInput) {
      throw this.failed(job, startTime, 'InvalidInput', invalidInput, false);
    }

    await job.updateProgress(25);

    const result = await Effect.runPromise(
      Effect.either(
        this.generateAudioUseCase.execute({
          sourceType,
          sourceId,
          text,
          date: date ? new Date(date) : new Date(),
        }),
      ),
    );

    if (Either.isLeft(result)) {
      const error = result.left;
      throw this.failed(
        job,
        startTime,
        error._tag,
        failureMessage(error),
        RETRYABLE[error._tag],
      );
    }

    await job.updateProgress(100);

    this.logger.log({
      jobId: job.id,
      sourceType,
      sourceId,
      operation: 'complete',
      status: 'success',
      durationMs: Date.now() - startTime,
      audioFileId: result.right,
    });

    return { success: true, audioFileId: result.right };
  }

  // UnrecoverableError skips the remaining attempts and counts as terminal,
  // so the failure email goes out on the first fatal error.
  private failed(
    job: Job<GenerateAudioJobData>,
    startTime: number,
    errorType: GenerateAudioError['_tag'] | 'InvalidInput',
    message: string,
    shouldRetry: boolean,
  ): Error {
    this.logger.error({
      jobId: job.id,
      sourceType: job.data.sourceType,
      sourceId: job.data.sourceId,
      operation: 'complete',
      status: 'error',
      durationMs: Date.now() - startTime,
      error: message,
      errorType,
      shouldRetry,
      attempt: job.attemptsMade + 1,
    });
    return shouldRetry ? new Error(message) : new UnrecoverableError(message);
  }

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
