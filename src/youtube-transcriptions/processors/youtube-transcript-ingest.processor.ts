import {
  IngestTranscriptJobData,
  YOUTUBE_TRANSCRIPT_INGEST_QUEUE,
} from '@libs/queue';
import { createWorker } from '@libs/queue/create-worker';
import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Job, Queue, Worker } from 'bullmq';
import { YoutubeTranscriptionsService } from '../services/youtube-transcriptions.service';

/**
 * Drains the hand-picked video URLs queued by POST /api/youtube/transcriptions.
 * The whole ingest pipeline already lives in processSingleVideoUrl, so this
 * worker only moves the work off the request. Concurrency is 1 because YouTube
 * rate limits transcript fetching, which is why that method needs three
 * fallbacks in the first place.
 */
@Injectable()
export class YoutubeTranscriptIngestProcessor
  implements OnModuleInit, OnModuleDestroy
{
  private worker: Worker;
  private readonly logger = new Logger(YoutubeTranscriptIngestProcessor.name);

  constructor(
    @Inject(YOUTUBE_TRANSCRIPT_INGEST_QUEUE)
    private readonly queue: Queue,
    private readonly youtubeTranscriptionsService: YoutubeTranscriptionsService,
  ) {}

  onModuleInit() {
    this.worker = createWorker(
      this.queue,
      (job: Job<IngestTranscriptJobData>) => this.ingestTranscript(job),
      { logger: this.logger },
    );

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
