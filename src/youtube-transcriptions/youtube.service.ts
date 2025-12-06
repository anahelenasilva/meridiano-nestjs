import { Injectable } from '@nestjs/common';
import { Innertube } from 'youtubei.js';
import { VideoMetadata } from '../shared/types/video';

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
   * @param channelId - The YouTube channel ID
   * @param maxVideos - Maximum number of videos to fetch
   * @returns Array of video metadata
   */
  async getChannelVideos(channelId: string, maxVideos: number) {
    try {
      await this.initialize();

      if (!this.youtube) {
        throw new Error('Failed to initialize YouTube client');
      }

      console.log(`Fetching videos from channel: ${channelId}`);

      const channel = await this.youtube.getChannel(channelId);
      const videos = await channel.getVideos();

      const videoMetadataList: VideoMetadata[] = [];
      let count = 0;

      for (const video of videos.videos) {
        if (count >= maxVideos) break;

        if (video.type === 'Video') {
          const v = video as any; // Type assertion to bypass union type checking

          const metadata: VideoMetadata = {
            videoId: v.id,
            title: v.title.text || 'No title',
            url: `https://www.youtube.com/watch?v=${v.id}`,
            publishedAt: v.published.text || 'Unknown',
            description: v.description || undefined,
            thumbnailUrl: v.thumbnails[0]?.url || undefined,
          };

          videoMetadataList.push(metadata);
          count++;
        }
      }

      console.log(
        `Found ${videoMetadataList.length} videos from channel ${channelId}`,
      );
      return videoMetadataList;
    } catch (error) {
      console.error(`Error fetching videos from channel ${channelId}:`, error);
      throw error;
    }
  }
}
