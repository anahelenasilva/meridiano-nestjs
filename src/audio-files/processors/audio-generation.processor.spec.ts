import { createWorker } from '@libs/queue/create-worker';
import { GenerateAudioJobData } from '@libs/queue/interfaces/audio-job.interface';
import { Logger } from '@nestjs/common';
import { Job, Queue, Worker } from 'bullmq';
import { mock } from 'jest-mock-extended';
import { GenerateAudioUseCase } from '../usecases/generate-audio.usecase';
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

  it('fails a fatal error without retrying', async () => {
    generateAudioUseCase.execute.mockResolvedValue({
      success: false,
      error: 'Invalid API key',
    });
    const job = createJob();

    await expect(processor.processAudioGeneration(job)).rejects.toMatchObject({
      name: 'UnrecoverableError',
    });
    expect(job.discard).not.toHaveBeenCalled();
  });

  it('rethrows a retryable error as a plain error', async () => {
    generateAudioUseCase.execute.mockResolvedValue({
      success: false,
      error: 'rate limit',
    });

    await expect(
      processor.processAudioGeneration(createJob()),
    ).rejects.toMatchObject({ name: 'Error' });
  });
});
