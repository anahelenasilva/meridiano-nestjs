import {
  IngestTranscriptJobData,
  YOUTUBE_TRANSCRIPT_INGEST_QUEUE,
} from '@libs/queue';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { YoutubeChannelsService } from '../../youtube-channels/youtube-channels.service';

export type FailedIngestJob = {
  jobId: string;
  videoUrl: string;
  channelName: string;
  reason: string;
};

const UNKNOWN_CHANNEL = 'Unknown channel';

/**
 * The dismissible failure strip on the transcriptions page. Reads the ingest
 * queue directly, so there is no jobs table to keep in sync. A Redis problem
 * returns an empty list rather than breaking the page.
 */
@Injectable()
export class ListFailedIngestJobsQuery {
  private readonly logger = new Logger(ListFailedIngestJobsQuery.name);

  constructor(
    @Inject(YOUTUBE_TRANSCRIPT_INGEST_QUEUE)
    private readonly ingestQueue: Queue,
    private readonly youtubeChannelsService: YoutubeChannelsService,
  ) {}

  async execute(): Promise<FailedIngestJob[]> {
    try {
      const jobs = (await this.ingestQueue.getJobs([
        'failed',
      ])) as Job<IngestTranscriptJobData>[];

      const channelNames = await this.resolveChannelNames(jobs);

      return jobs.map((job) => ({
        jobId: job.id as string,
        videoUrl: job.data.videoUrl,
        channelName: channelNames.get(job.data.channelDbId) ?? UNKNOWN_CHANNEL,
        reason: job.failedReason ?? 'Unknown error',
      }));
    } catch (error) {
      this.logger.error(
        `Failed to read the ingest queue: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return [];
    }
  }

  private async resolveChannelNames(
    jobs: Job<IngestTranscriptJobData>[],
  ): Promise<Map<string, string>> {
    const ids = [...new Set(jobs.map((job) => job.data.channelDbId))];

    const entries = await Promise.all(
      ids.map(async (id) => {
        const channel = await this.youtubeChannelsService.getChannelById(id);
        return [id, channel?.name ?? UNKNOWN_CHANNEL] as const;
      }),
    );

    return new Map(entries);
  }
}
