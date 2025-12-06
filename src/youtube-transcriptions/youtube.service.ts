import { Injectable } from '@nestjs/common';
import { Innertube } from 'youtubei.js';

import { ChannelConfig } from '../shared/types/channel';
import { VideoMetadata } from '../shared/types/video';
import { parseRelativeTime } from './helpers/parse-relative-time';

@Injectable()
export class YouTubeService {
  private youtube: Innertube | null = null;

  constructor() {}

  /**
   * Initialize the YouTube client
   */
  private async initialize() {
    if (!this.youtube) {
      this.youtube = await Innertube.create();
    }
  }

  /**
   * Fetch videos from a YouTube channel
   * @param channelConfig - The channel configuration
   * @param maxVideos - Maximum number of videos to fetch
   * @returns Array of video metadata
   */
  async getChannelVideos(channelConfig: ChannelConfig) {
    try {
      await this.initialize();

      if (!this.youtube) {
        throw new Error('Failed to initialize YouTube client');
      }

      const { channelId, channelName, channelDescription, maxVideos } =
        channelConfig;

      console.log(
        `Fetching videos from channel: ${channelId}: ${channelDescription}`,
      );

      const channelData = await this.youtube.getChannel(channelId);
      const videos = await channelData.getVideos();

      const videoMetadataList: VideoMetadata[] = [];
      let count = 0;

      for (const video of videos.videos) {
        if (count >= maxVideos) break;

        if (video.type === 'Video') {
          const v = video as any;

          const metadata: VideoMetadata = {
            channel: {
              id: channelId,
              name: channelName,
              description: channelDescription,
            },
            videoId: v.id,
            title: v.title.text || 'No title',
            url: `https://www.youtube.com/watch?v=${v.id}`,
            publishedAt: parseRelativeTime(v.published.text || 'Unknown'),
            description: v.description || undefined,
            thumbnailUrl: v.thumbnails[0]?.url || undefined,
          };

          videoMetadataList.push(metadata);
          count++;
        }
      }

      console.log(
        `Found ${videoMetadataList.length} videos from channel ${channelId}: ${channelName}`,
      );
      return videoMetadataList;
    } catch (error) {
      console.error(
        `Error fetching videos from channel ${channelConfig.channelId}: ${channelConfig.channelName}:`,
        error,
      );
      throw error;
    }
  }
}
