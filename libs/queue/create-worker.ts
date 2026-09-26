import type { Logger } from '@nestjs/common';
import { Job, Processor, Queue, Worker } from 'bullmq';

export interface CreateWorkerOptions<Data, Result> {
  logger: Logger;
  concurrency?: number;
  onTerminalFailure?: (job: Job<Data, Result>, err: Error) => void;
}

// Redis drops the worker's connection on shutdown and on transient network
// blips; BullMQ reconnects on its own, so these are not worth an error log.
const CONNECTION_NOISE = ['ECONNRESET', 'closed'];

/**
 * Starts a BullMQ worker on `queue` using the queue's own Redis connection.
 * Logs completions, retries and terminal failures under `logger`, and calls
 * `onTerminalFailure` once per job, after its last attempt fails or it throws
 * an `UnrecoverableError`. The caller owns `worker.close()`.
 */
export function createWorker<Data, Result>(
  queue: Queue,
  handler: Processor<Data, Result>,
  {
    logger,
    concurrency = 1,
    onTerminalFailure,
  }: CreateWorkerOptions<Data, Result>,
): Worker<Data, Result> {
  const worker = new Worker<Data, Result>(queue.name, handler, {
    connection: queue.opts.connection,
    concurrency,
  });

  worker.on('completed', (job) => {
    logger.log(`${queue.name} job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    if (!job) {
      logger.error(`${queue.name} job failed without job data`, err.stack);
      return;
    }

    const maxAttempts = job.opts.attempts ?? 1;
    const isTerminal =
      job.attemptsMade >= maxAttempts || err.name === 'UnrecoverableError';

    if (!isTerminal) {
      logger.warn(
        `${queue.name} job ${job.id} failed attempt ${job.attemptsMade}/${maxAttempts}; retry scheduled: ${err.message}`,
      );
      return;
    }

    logger.error(
      `${queue.name} job ${job.id} failed after ${job.attemptsMade}/${maxAttempts} attempts`,
      err.stack,
    );
    onTerminalFailure?.(job, err);
  });

  worker.on('error', (err) => {
    if (CONNECTION_NOISE.some((noise) => err.message?.includes(noise))) {
      logger.debug(`${queue.name} worker connection error: ${err.message}`);
      return;
    }
    logger.error(`${queue.name} worker error`, err.stack);
  });

  return worker;
}
