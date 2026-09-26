import { Logger } from '@nestjs/common';
import { Job, Queue, Worker } from 'bullmq';
import { mock } from 'jest-mock-extended';
import { createWorker } from './create-worker';

jest.mock('bullmq', () => ({
  ...jest.requireActual<typeof import('bullmq')>('bullmq'),
  Worker: jest.fn(),
}));

describe('createWorker', () => {
  const connection = {};
  const queue = {
    name: 'test-queue',
    opts: { connection },
  } as unknown as Queue;
  const handler = jest.fn();
  const logger = mock<Logger>();
  const mockWorker = mock<Worker>();
  const onTerminalFailure = jest.fn();

  beforeEach(() => {
    (Worker as unknown as jest.Mock).mockImplementation(() => mockWorker);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  function listener<T extends (...args: never[]) => void>(event: string): T {
    const call = mockWorker.on.mock.calls.find(([name]) => name === event);
    if (!call) throw new Error(`no ${event} listener registered`);
    return call[1] as unknown as T;
  }

  const failed = () =>
    listener<(job: Job | undefined, err: Error) => void>('failed');

  function job(attemptsMade: number, attempts?: number): Job {
    return { id: 'job-1', attemptsMade, opts: { attempts } } as Job;
  }

  it('builds the worker from the queue name and connection', () => {
    createWorker(queue, handler, { logger, concurrency: 4 });

    expect(Worker).toHaveBeenCalledWith('test-queue', handler, {
      connection,
      concurrency: 4,
    });
  });

  it('calls onTerminalFailure when the last configured attempt fails', () => {
    createWorker(queue, handler, { logger, onTerminalFailure });
    const err = new Error('boom');

    failed()(job(3, 3), err);

    expect(onTerminalFailure).toHaveBeenCalledTimes(1);
    expect(onTerminalFailure).toHaveBeenCalledWith(job(3, 3), err);
    expect(logger.error).toHaveBeenCalledWith(
      'test-queue job job-1 failed after 3/3 attempts',
      err.stack,
    );
  });

  it('logs a retry and skips onTerminalFailure while attempts remain', () => {
    createWorker(queue, handler, { logger, onTerminalFailure });

    failed()(job(1, 3), new Error('boom'));

    expect(onTerminalFailure).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      'test-queue job job-1 failed attempt 1/3; retry scheduled: boom',
    );
  });

  it('treats a job without configured attempts as terminal on its first failure', () => {
    createWorker(queue, handler, { logger, onTerminalFailure });

    failed()(job(1), new Error('boom'));

    expect(onTerminalFailure).toHaveBeenCalledTimes(1);
  });

  it('treats an UnrecoverableError as terminal while attempts remain', () => {
    createWorker(queue, handler, { logger, onTerminalFailure });
    const err = new Error('bad input');
    err.name = 'UnrecoverableError';

    failed()(job(1, 3), err);

    expect(onTerminalFailure).toHaveBeenCalledTimes(1);
  });

  it('logs a failure without a job and skips onTerminalFailure', () => {
    createWorker(queue, handler, { logger, onTerminalFailure });
    const err = new Error('boom');

    failed()(undefined, err);

    expect(onTerminalFailure).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      'test-queue job failed without job data',
      err.stack,
    );
  });

  it('logs connection noise at debug level and other worker errors as errors', () => {
    createWorker(queue, handler, { logger });
    const onError = listener<(err: Error) => void>('error');

    onError(new Error('read ECONNRESET'));
    onError(new Error('Connection is closed.'));
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledTimes(2);

    const err = new Error('script failed');
    onError(err);
    expect(logger.error).toHaveBeenCalledWith(
      'test-queue worker error',
      err.stack,
    );
  });
});
