import { DatabaseService } from '@libs/database';
import { QueueService } from '@libs/queue';
import { Injectable, Logger } from '@nestjs/common';
import { ChannelConfig } from '../../shared/types/channel';
import { VideoWithTranscript } from '../../shared/types/video';
import { YoutubeChannelsService } from '../../youtube-channels/youtube-channels.service';
import { extractVideoId } from '../helpers/extract-video-id';
import { StorageService } from './storage.service';
import { TranscriptFetcherService } from './transcript-fetcher.service';
import { YoutubeTranscriptionsService } from './youtube-transcriptions.service';
import { YouTubeService } from './youtube.service';

// Fetches transcripts from YouTube, saves them to storage and the database,
// and enqueues their summary jobs. The ingest processor, the
// process-transcription-files use case and the runYoutubeTranscripts script
// call it. Reads and the other writes live in YoutubeTranscriptionsService.
@Injectable()
export class YoutubeTranscriptionsExtractionService {
  private readonly logger = new Logger(
    YoutubeTranscriptionsExtractionService.name,
  );

  constructor(
    private readonly youtubeService: YouTubeService,
    private readonly transcriptFetcher: TranscriptFetcherService,
    private readonly storageService: StorageService,
    private readonly databaseService: DatabaseService,
    private readonly queueService: QueueService,
    private readonly youtubeChannelsService: YoutubeChannelsService,
    private readonly youtubeTranscriptionsService: YoutubeTranscriptionsService,
  ) {}

  /**
   * Extract transcripts from videos in a single channel
   * @param channel - The channel configuration
   */
  async extractChannelTranscripts(channel: ChannelConfig) {
    this.logger.log(
      `Processing channel: ${channel.channelName} [channelId=${channel.channelId}, maxVideos=${channel.maxVideos}]`,
    );

    try {
      const videos = await this.youtubeService.getChannelVideos(channel);

      if (videos.length === 0) {
        this.logger.log(
          `No videos found for channel: ${channel.channelName} [channelId=${channel.channelId}]`,
        );
        return;
      }

      let successCount = 0;
      let failureCount = 0;

      for (const video of videos) {
        try {
          this.logger.log(
            `Processing: ${video.title} [videoId=${video.videoId}, channelId=${channel.channelId}]`,
          );

          const { transcript, transcriptText } =
            await this.transcriptFetcher.fetch(video.videoId);

          const videoWithTranscript: VideoWithTranscript = {
            ...video,
            transcript,
            transcriptText,
          };

          await this.storageService.saveTranscript(
            channel.channelId,
            videoWithTranscript,
          );

          successCount++;
          this.logger.log(
            `✓ Successfully processed video: ${video.title} [videoId=${video.videoId}, channelId=${channel.channelId}]`,
          );
        } catch (error) {
          failureCount++;
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          this.logger.error(
            `✗ Failed to process video: ${video.title} [videoId=${video.videoId}, channelId=${channel.channelId}]: ${errorMessage}`,
          );
        }
      }

      this.logger.log(
        `Channel processing complete: ${channel.channelName} [channelId=${channel.channelId}, success=${successCount}, failed=${failureCount}]`,
      );

      if (successCount === 0) {
        throw new Error(
          `Failed to extract any transcripts from channel ${channel.channelName} (${failureCount} video(s) failed)`,
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Error processing channel ${channel.channelName} [channelId=${channel.channelId}]: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Extract transcripts from all configured channels. A failing channel does
   * not stop the remaining ones.
   * @param channels - Array of channel configurations
   */
  async extractAll(channels: ChannelConfig[]) {
    this.logger.log(
      `🚀 Starting transcript extraction for ${channels.length} channel(s)...`,
    );

    const startTime = Date.now();
    let succeeded = 0;
    let failed = 0;

    for (const channel of channels) {
      try {
        await this.extractChannelTranscripts(channel);
        succeeded++;
      } catch (error) {
        failed++;
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Total failed: ${failed} to process channel: ${channel.channelName} [channelId=${channel.channelId}]: ${errorMessage}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    this.logger.log(
      `🎉 Extraction complete! Total channels processed: ${succeeded}/${channels.length}, total time: ${duration}s`,
    );

    return { succeeded, failed };
  }

  /**
   * Process a single video URL and save its transcription
   * @param videoUrl - The YouTube video URL
   * @param channelId - The channel ID from config
   * @param proxyUrl - Optional proxy URL for transcript fetching
   * @param customPrompt - Optional custom prompt for summary (max 500 chars)
   * @param generateAudio - Optional flag to enqueue audio generation after summary
   * @returns The transcription ID or null if video already exists
   */
  async processSingleVideoUrl(
    videoUrl: string,
    channelDbId: string,
    proxyUrl?: string,
    customPrompt?: string,
    generateAudio?: boolean,
  ): Promise<string | null> {
    try {
      this.logger.log(
        `Processing single video: ${videoUrl} [channelId=${channelDbId}]`,
      );

      const channelConfig =
        await this.youtubeChannelsService.getChannelById(channelDbId);

      if (!channelConfig) {
        throw new Error(`Channel ${channelDbId} not found in configuration`);
      }

      if (channelConfig.enabled === false) {
        throw new Error(`Channel ${channelDbId} is disabled`);
      }

      const videoId = extractVideoId(videoUrl);

      if (!videoId) {
        throw new Error('Invalid YouTube URL or unable to extract video ID');
      }

      const videoMetadata = await this.youtubeService.getVideoMetadata(
        videoId,
        channelConfig.channelId,
        channelConfig.name,
        channelConfig.description || '',
        channelConfig.id,
      );

      const { transcript, transcriptText } = await this.transcriptFetcher.fetch(
        videoId,
        { proxyUrl },
      );

      const videoWithTranscript: VideoWithTranscript = {
        ...videoMetadata,
        transcript,
        transcriptText,
      };

      await this.storageService.saveTranscript(
        channelDbId,
        videoWithTranscript,
      );

      const transcriptionId = await this.addTranscription(
        videoWithTranscript,
        undefined,
        customPrompt,
      );

      if (transcriptionId === null) {
        this.logger.log(
          `Video already exists in database [videoId=${videoId}, channelId=${channelDbId}]`,
        );
        return null;
      }

      this.logger.log(
        `Enqueueing summary generation for transcription ID ${transcriptionId}... [videoId=${videoId}, channelId=${channelDbId}]`,
      );
      await this.queueService.addTranscriptionSummaryJob(
        transcriptionId,
        transcriptText,
        videoWithTranscript.title,
        generateAudio,
        channelDbId,
      );

      this.logger.log(
        `✓ Successfully processed video: ${videoMetadata.title} (ID: ${transcriptionId}) [videoId=${videoId}, channelId=${channelDbId}]`,
      );

      return transcriptionId;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Error processing video URL ${videoUrl} [channelId=${channelDbId}]: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Save a transcription to the database
   * @param videoData - The video with transcript data
   * @param transcriptionSummary - Optional summary of the transcription
   * @param customPrompt - Optional custom prompt for summary (max 500 chars)
   * @returns The inserted ID or null on error
   */
  async addTranscription(
    videoData: VideoWithTranscript,
    transcriptionSummary?: string,
    customPrompt?: string,
  ): Promise<string | null> {
    const logger = this.logger;
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      const stmt = db.prepare(`
        INSERT INTO youtube_transcriptions (
          channel_id, video_title, posted_at, video_url,
          processed_at, transcription_text, transcription_summary, thumbnail_url, custom_prompt
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        [
          videoData.channel.databaseId,
          videoData.title,
          videoData.publishedAt !== 'Unknown' ? videoData.publishedAt : null,
          videoData.url,
          new Date().toISOString(),
          videoData.transcriptText,
          transcriptionSummary || null,
          videoData.thumbnailUrl || null,
          customPrompt || null,
        ],
        function (this: { lastID?: string }, err: Error | null) {
          if (err) {
            const errorWithCode = err as Error & { code?: string };
            if (
              err.message.includes('UNIQUE constraint failed') ||
              err.message.includes('duplicate key value') ||
              errorWithCode.code === '23505'
            ) {
              logger.log(
                `Transcription already exists for video: ${videoData.title} [videoId=${videoData.videoId}, channelId=${videoData.channel?.id}]`,
              );
              resolve(null);
            } else {
              reject(err);
            }
          } else {
            resolve(this.lastID ?? null);
          }
          stmt.finalize();
        },
      );
    });
  }

  /**
   * Process a transcription JSON file: read, summarize, and save to database
   * @param filePath - Path to the JSON file
   * @returns Object with success status and optional error message
   */
  async processTranscriptionFile(
    // filePath: string,
    videoData: VideoWithTranscript,
    generateAudio?: boolean,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // const fileContent = await fs.readFile(filePath, 'utf-8');
      // const videoData: VideoWithTranscript = JSON.parse(fileContent);

      if (
        !videoData.transcriptText ||
        !videoData.title ||
        !videoData.url ||
        !videoData.videoId ||
        !videoData.channel?.id ||
        !videoData.channel?.name
      ) {
        return {
          success: false,
          error: 'Missing required fields in video data',
        };
      }

      const transcriptAlreadyExists =
        await this.youtubeTranscriptionsService.getTranscriptionByVideoUrl(
          videoData.url,
        );
      if (transcriptAlreadyExists) {
        return {
          success: false,
          error: `Transcription already exists for video: ${videoData.title}`,
        };
      }

      this.logger.log(
        `Processing transcription for: ${videoData.title} by ${videoData.channel.name} [videoId=${videoData.videoId}, channelId=${videoData.channel.id}]`,
      );

      // Save transcription to database first without summary
      const insertedId = await this.addTranscription(videoData);

      if (insertedId === null) {
        return {
          success: false,
          error: 'Transcription already exists or failed to insert',
        };
      }

      this.logger.log(
        `Enqueueing summary generation for transcription ID ${insertedId}... [videoId=${videoData.videoId}, channelId=${videoData.channel.id}]`,
      );
      await this.queueService.addTranscriptionSummaryJob(
        insertedId,
        videoData.transcriptText,
        videoData.title,
        generateAudio,
        videoData.channel.id,
      );

      this.logger.log(
        `✓ Successfully processed and saved transcription (ID: ${insertedId}) [videoId=${videoData.videoId}, channelId=${videoData.channel.id}]`,
      );
      return { success: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to process file: ${errorMessage}`,
      };
    }
  }
}
