import { Injectable } from '@nestjs/common';
import { YoutubeTranscriptionsService } from '../../youtube-transcriptions/services/youtube-transcriptions.service';
import { YoutubeTranscription } from '../../youtube-transcriptions/entities/youtube-transcription.entity';
import { buildRssFeed, RssFeedItem } from '../helpers/build-rss-feed';
import { YoutubeFeedQueryOptions } from '../feeds.types';
import { FEED_DEFAULT_ITEM_LIMIT } from '../helpers/parse-feed-query';

export const YOUTUBE_FEED_CHANNEL_TITLE = 'Meridiano YouTube Transcriptions';
export const YOUTUBE_FEED_CHANNEL_DESCRIPTION =
  'Latest YouTube transcriptions curated by Meridiano';

@Injectable()
export class GetYoutubeFeedQuery {
  constructor(
    private readonly youtubeTranscriptionsService: YoutubeTranscriptionsService,
  ) {}

  async execute(
    channelLink: string,
    options: YoutubeFeedQueryOptions = {},
  ): Promise<string> {
    const { limit = FEED_DEFAULT_ITEM_LIMIT, channelId } = options;

    const transcriptions =
      await this.youtubeTranscriptionsService.getTranscriptionsPaginated({
        page: 1,
        perPage: limit,
        sort_by: 'processed_at',
        direction: 'desc',
        channel_id: channelId,
      });

    return buildRssFeed({
      title: YOUTUBE_FEED_CHANNEL_TITLE,
      link: channelLink,
      description: YOUTUBE_FEED_CHANNEL_DESCRIPTION,
      items: transcriptions.map(toFeedItem),
    });
  }
}

function toFeedItem(transcription: YoutubeTranscription): RssFeedItem {
  return {
    guid: transcription.id,
    title: transcription.videoTitle,
    link: transcription.videoUrl,
    pubDate: transcription.postedAt ?? transcription.processedAt,
    description: transcription.transcriptionSummary,
  };
}
