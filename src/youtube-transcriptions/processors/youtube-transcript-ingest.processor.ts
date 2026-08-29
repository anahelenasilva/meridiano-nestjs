import {
  IngestTranscriptJobData,
  YOUTUBE_TRANSCRIPT_INGEST_QUEUE,
} from '@libs/queue';
import { RedisService } from '@libs/redis';
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { YoutubeTranscriptionsService } from '../services/youtube-transcriptions.service';

/**
 * Drains the hand-picked video URLs queued by POST /api/youtube/transcriptions.
 * The whole ingest pipeline already lives in processSingleVideoUrl, so this
 * worker only moves the work off the request. Concurrency is 1 because YouTube
 * rate limits transcript fetching, which is why that method needs three
 * fallbacks in the first place.
 */
@Injectable()
export class YoutubeTranscriptIngestProcessor implements OnModuleInit, OnModuleDestroy {
  private worker: Worker;
  private readonly logger = new Logger(YoutubeTranscriptIngestProcessor.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly youtubeTranscriptionsService: YoutubeTranscriptionsService,
  ) {}

  onModuleInit() {
    this.worker = new Worker(
      YOUTUBE_TRANSCRIPT_INGEST_QUEUE,
      async (job: Job<IngestTranscriptJobData>) => {
        return await this.ingestTranscript(job);
      },
      {
        connection: this.redisService.getClient(),
        concurrency: 1,
      },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(
        `Ingest job ${job?.id} failed: ${err.message} [videoUrl=${job?.data?.videoUrl}]`,
      );
    });

    // Redis closes during shutdown and tests; those errors are expected.
    this.worker.on('error', (err: Error) => {
      if (
        err.message?.includes('ECONNRESET') ||
        err.message?.includes('closed')
      ) {
        return;
      }
      this.logger.error(`Ingest worker error: ${err.message}`);
    });

    this.logger.log('YouTube transcript ingest worker initialized');
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
    }
  }

  async ingestTranscript(
    job: Job<IngestTranscriptJobData>,
  ): Promise<{ success: boolean; transcriptionId: string | null }> {
    const { videoUrl, channelDbId, customPrompt, generateAudio } = job.data;

    const transcriptionId =
      await this.youtubeTranscriptionsService.processSingleVideoUrl(
        videoUrl,
        channelDbId,
        undefined,
        customPrompt,
        generateAudio,
      );

    return { success: true, transcriptionId };
  }
}
