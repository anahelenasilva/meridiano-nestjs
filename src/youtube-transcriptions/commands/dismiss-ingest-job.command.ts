import { YOUTUBE_TRANSCRIPT_INGEST_QUEUE } from '@libs/queue';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';

/**
 * Removes one failed ingest job so it stops showing in the failure strip.
 */
@Injectable()
export class DismissIngestJobCommand {
  constructor(
    @Inject(YOUTUBE_TRANSCRIPT_INGEST_QUEUE)
    private readonly ingestQueue: Queue,
  ) {}

  async execute(jobId: string): Promise<{ dismissed: boolean }> {
    const job = await this.ingestQueue.getJob(jobId);

    if (!job) {
      throw new NotFoundException('Ingest job not found');
    }

    await job.remove();

    return { dismissed: true };
  }
}
