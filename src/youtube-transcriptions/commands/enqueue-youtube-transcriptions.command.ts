import { QueueService } from '@libs/queue';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { YoutubeChannelsService } from '../../youtube-channels/youtube-channels.service';
import { canonicalVideoUrl } from '../helpers/canonical-video-url';
import { extractVideoId } from '../helpers/extract-video-id';
import { YoutubeTranscriptionsService } from '../services/youtube-transcriptions.service';

export type EnqueueYoutubeTranscriptionsInput = {
  urls: string[];
  channelDbId: string;
  customPrompt?: string;
  generateAudio?: boolean;
};

export type EnqueueTranscriptionsResponse = {
  accepted: string[];
  skipped: string[];
  rejected: { url: string; reason: string }[];
};

const NOT_A_YOUTUBE_URL = 'Not a recognizable YouTube video URL';

/**
 * Validates a batch of hand-picked video URLs and queues the survivors. Every
 * check here is cheap and offline: the transcript fetch itself happens in
 * YoutubeTranscriptIngestProcessor, so the request never blocks on YouTube.
 */
@Injectable()
export class EnqueueYoutubeTranscriptionsCommand {
  constructor(
    private readonly youtubeChannelsService: YoutubeChannelsService,
    private readonly youtubeTranscriptionsService: YoutubeTranscriptionsService,
    private readonly queueService: QueueService,
  ) {}

  async execute(
    input: EnqueueYoutubeTranscriptionsInput,
  ): Promise<EnqueueTranscriptionsResponse> {
    const { urls, channelDbId, customPrompt, generateAudio } = input;

    const channel =
      await this.youtubeChannelsService.getChannelById(channelDbId);

    if (!channel) {
      throw new NotFoundException('Channel not found in configuration');
    }

    if (channel.enabled === false) {
      throw new BadRequestException('Channel is disabled');
    }

    const rejected: { url: string; reason: string }[] = [];
    // Keyed by video id so two spellings of the same video collapse to one.
    const candidates = new Map<string, string>();

    for (const url of urls) {
      const videoId = extractVideoId(url.trim());

      if (!videoId) {
        rejected.push({ url, reason: NOT_A_YOUTUBE_URL });
        continue;
      }

      candidates.set(videoId, canonicalVideoUrl(videoId));
    }

    const existing =
      await this.youtubeTranscriptionsService.findExistingVideoUrls([
        ...candidates.values(),
      ]);

    const accepted: string[] = [];
    const skipped: string[] = [];

    for (const [videoId, videoUrl] of candidates) {
      if (existing.has(videoUrl)) {
        skipped.push(videoUrl);
        continue;
      }

      await this.queueService.addTranscriptIngestJob(
        {
          videoUrl,
          channelDbId,
          customPrompt,
          generateAudio,
        },
        videoId,
      );

      accepted.push(videoUrl);
    }

    return { accepted, skipped, rejected };
  }
}
