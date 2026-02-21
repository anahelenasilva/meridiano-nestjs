import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import path from 'path';
import { ClientType, Innertube, Platform, Types } from 'youtubei.js/web';
import { ChannelConfig } from '../../shared/types/channel';
import { VideoMetadata } from '../../shared/types/video';
import { parseRelativeTime } from '../helpers/parse-relative-time';

@Injectable()
export class YouTubeService {
  private youtube: Innertube | null = null;

  constructor() {}

  private async initialize() {
    if (!this.youtube) {
      this.youtube = await Innertube.create({
        generate_session_locally: true,
        lang: 'en',
        location: 'US',
        retrieve_player: false,
      });
    }
  }

  /**
   * Get video metadata from a video ID
   * @param videoId - The YouTube video ID
   * @param channelId - The channel ID
   * @param channelName - The channel name
   * @param channelDescription - The channel description
   * @returns Video metadata
   */
  async getVideoMetadata(
    videoId: string,
    channelId: string,
    channelName: string,
    channelDescription: string,
    channelDatabaseId: string,
  ): Promise<VideoMetadata> {
    try {
      await this.initialize();

      if (!this.youtube) {
        throw new Error('Failed to initialize YouTube client');
      }

      console.log(`Fetching metadata for video: ${videoId}`);

      const info = await this.youtube.getInfo(videoId);
      const basicInfo = info.basic_info;

      const metadata: VideoMetadata = {
        channel: {
          id: channelId,
          databaseId: channelDatabaseId,
          name: channelName,
          description: channelDescription,
        },
        videoId: videoId,
        title: basicInfo.title || 'No title',
        url: `https://www.youtube.com/watch?v=${videoId}`,
        publishedAt: basicInfo.start_timestamp
          ? new Date(basicInfo.start_timestamp).toISOString()
          : new Date().toISOString(),
        description: basicInfo.short_description || undefined,
        thumbnailUrl: basicInfo.thumbnail?.[0]?.url || undefined,
      };

      console.log(`Successfully fetched metadata for video: ${metadata.title}`);
      return metadata;
    } catch (error) {
      console.error(`Error fetching metadata for video ${videoId}:`, error);
      throw error;
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

      const {
        channelId,
        channelName,
        channelDescription,
        maxVideos,
        databaseId,
      } = channelConfig;

      console.log(`Fetching videos from channel ${channelName}`);

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
              databaseId,
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
        `Found ${videoMetadataList.length} videos from channel ${channelName}`,
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

  async downloadAudioFromVideo(videoId: string) {
    try {
      await this.initialize();

      console.log(`Initialize YouTube client successfully`);

      if (!this.youtube) {
        throw new Error('Failed to initialize YouTube client');
      }

      Platform.shim.eval = (
        data: Types.BuildScriptResult,
        env: Record<string, Types.VMPrimative>,
      ) => {
        const properties = [];

        if (env.n) {
          properties.push(
            `n: exportedVars.nFunction("${env.n as string}")` as never,
          );
        }

        if (env.sig) {
          properties.push(
            `sig: exportedVars.sigFunction("${env.sig as string}")` as never,
          );
        }

        const code = `${data.output}\nreturn { ${properties.join(', ')} }`;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-implied-eval
        return new Function(code)();
      };

      const innertube = await Innertube.create({
        generate_session_locally: true,
        lang: 'en',
        location: 'US',
        retrieve_innertube_config: true,
        client_type: ClientType.WEB,
      });

      console.log(`Downloading audio from video: ${videoId}`);

      const audio = await innertube.download(videoId, {
        type: 'audio',
      });

      console.log(`Downloaded audio from video: ${videoId}`);

      //save downloaded audio to a file
      const filePath = path.join(
        '/Users/anahelenadasilva/Desktop/dev/meridiano/meridiano-nestjs/src/youtube-transcriptions/services/',
        '',
        `${videoId}.mp3`,
      );
      await fs.writeFile(filePath, audio);

      console.log(`Downloaded audio from video: ${videoId}`);

      return audio;
    } catch (error) {
      console.error(`Error downloading audio from video ${videoId}:`, error);
      throw error;
    }
  }
}
