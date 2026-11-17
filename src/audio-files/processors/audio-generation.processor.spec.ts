import { createWorker } from '@libs/queue/create-worker';
import type { GenerateAudioJobData } from '@libs/audio';
import { Logger } from '@nestjs/common';
import { Job, Queue, Worker } from 'bullmq';
import { Effect } from 'effect';
import OpenAI from 'openai';
import { mock } from 'jest-mock-extended';
import {
  ProviderNotConfigured,
  toProviderError,
} from '../../ai/provider-error';
import {
  AudioRecordNotSaved,
  AudioUploadFailed,
  GenerateAudioUseCase,
  StorageNotConfigured,
} from '../usecases/generate-audio.usecase';
import { AudioGenerationFailureNotifier } from './audio-generation-failure.notifier';
import { AudioGenerationProcessor } from './audio-generation.processor';

jest.mock('@libs/queue/create-worker');

describe('AudioGenerationProcessor', () => {
  const mockQueue = mock<Queue>();
  const mockWorker = mock<Worker>();
  const generateAudioUseCase = mock<GenerateAudioUseCase>();
  const failureNotifier = mock<AudioGenerationFailureNotifier>();
  let processor: AudioGenerationProcessor;

  const createJob = () =>
    mock<Job<GenerateAudioJobData>>({
      id: 'job-1',
      attemptsMade: 0,
      data: {
        sourceType: 'article',
        sourceId: 'a-1',
        text: 'some text',
        date: '2026-10-01',
      },
    });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(createWorker).mockReturnValue(mockWorker);
    processor = new AudioGenerationProcessor(
      generateAudioUseCase,
      mockQueue,
      failureNotifier,
    );
  });

  it('starts a worker with concurrency 2 that notifies on terminal failure', () => {
    processor.onModuleInit();
    const { onTerminalFailure } = jest.mocked(createWorker).mock.calls[0][2];
    const job = createJob();
    const err = new Error('boom');

    onTerminalFailure!(job, err);

    expect(createWorker).toHaveBeenCalledWith(mockQueue, expect.any(Function), {
      logger: expect.any(Logger),
      concurrency: 2,
      onTerminalFailure: expect.any(Function),
    });
    expect(failureNotifier.notify).toHaveBeenCalledWith(job, err);
  });

  it('returns the saved audio file id', async () => {
    generateAudioUseCase.execute.mockReturnValue(Effect.succeed('audio-1'));

    await expect(
      processor.processAudioGeneration(createJob()),
    ).resolves.toEqual({ success: true, audioFileId: 'audio-1' });
  });

  it('fails invalid job data without retrying or calling the use case', async () => {
    const job = createJob();
    job.data.text = '  ';

    await expect(processor.processAudioGeneration(job)).rejects.toMatchObject({
      name: 'UnrecoverableError',
      message: 'Invalid input: text is required and cannot be empty',
    });
    expect(generateAudioUseCase.execute).not.toHaveBeenCalled();
  });

  it.each([
    [
      'an OpenAI 429',
      toProviderError(
        new OpenAI.RateLimitError(
          429,
          undefined,
          'Rate limit reached',
          undefined,
        ),
      ),
      'Error',
    ],
    [
      'a connection error',
      toProviderError(
        new OpenAI.APIConnectionError({ message: 'Connection error.' }),
      ),
      'Error',
    ],
    [
      'a timeout',
      toProviderError(new OpenAI.APIConnectionTimeoutError()),
      'Error',
    ],
    [
      'an OpenAI 500',
      toProviderError(
        new OpenAI.InternalServerError(
          500,
          undefined,
          'Internal server error',
          undefined,
        ),
      ),
      'Error',
    ],
    [
      'an OpenAI 401',
      toProviderError(
        new OpenAI.AuthenticationError(
          401,
          undefined,
          'Incorrect API key provided',
          undefined,
        ),
      ),
      'UnrecoverableError',
    ],
    [
      'an OpenAI 400',
      toProviderError(
        new OpenAI.BadRequestError(
          400,
          undefined,
          'string_too_long',
          undefined,
        ),
      ),
      'UnrecoverableError',
    ],
    [
      'a missing TTS key',
      new ProviderNotConfigured({ message: 'OPENAI_API_KEY may be missing.' }),
      'UnrecoverableError',
    ],
    [
      'a missing S3 bucket',
      new StorageNotConfigured({
        message: 'S3_ARTICLES_BUCKET_NAME environment variable not set',
      }),
      'UnrecoverableError',
    ],
    [
      'an S3 upload failure',
      new AudioUploadFailed({ cause: new Error('socket hang up') }),
      'Error',
    ],
    [
      'an unsaved record',
      new AudioRecordNotSaved({ cause: 'saveAudioFile returned no id' }),
      'Error',
    ],
  ])('sorts %s into %s', async (_label, failure, name) => {
    generateAudioUseCase.execute.mockReturnValue(Effect.fail(failure));

    await expect(
      processor.processAudioGeneration(createJob()),
    ).rejects.toMatchObject({ name });
  });

  it("names the failure's tag and cause in the error BullMQ records", async () => {
    generateAudioUseCase.execute.mockReturnValue(
      Effect.fail(
        new AudioUploadFailed({ cause: new Error('socket hang up') }),
      ),
    );

    await expect(processor.processAudioGeneration(createJob())).rejects.toThrow(
      'AudioUploadFailed: socket hang up',
    );
  });
});
