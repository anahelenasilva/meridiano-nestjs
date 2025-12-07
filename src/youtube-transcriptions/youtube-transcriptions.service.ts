import { Injectable } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { ConfigService } from '../config/config.service';
import { DatabaseService } from '../database/database.service';
import { ChannelConfig } from '../shared/types/channel';
import { VideoWithTranscript } from '../shared/types/video';
import {
  DBYoutubeTranscription,
  YoutubeTranscription,
} from './entities/youtube-transcription.entity';
import { StorageService } from './storage.service';
import { TranscriptService } from './transcript.service';
import { YouTubeService } from './youtube.service';

@Injectable()
export class YoutubeTranscriptionsService {
  constructor(
    private readonly youtubeService: YouTubeService,
    private readonly transcriptService: TranscriptService,
    private readonly storageService: StorageService,
    private readonly databaseService: DatabaseService,
    private readonly aiService: AiService,
    private readonly configService: ConfigService,
  ) { }

  /**
   * Extract transcripts from videos in a single channel
   * @param channel - The channel configuration
   */
  async extractChannelTranscripts(channel: ChannelConfig) {
    console.log(`\n========================================`);
    console.log(`Processing channel: ${channel.channelName}`);
    console.log(`Channel ID: ${channel.channelId}`);
    console.log(`Max videos: ${channel.maxVideos}`);
    console.log(`========================================\n`);

    try {
      const videos = await this.youtubeService.getChannelVideos(channel);

      if (videos.length === 0) {
        console.log(`No videos found for channel: ${channel.channelName}`);
        return;
      }

      let successCount = 0;
      let failureCount = 0;

      for (const video of videos) {
        try {
          console.log(`\nProcessing: ${video.title}`);

          const transcript = await this.transcriptService.getTranscript(
            video.videoId,
          );
          const transcriptText =
            this.transcriptService.transcriptToText(transcript);

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
          console.log(`✓ Successfully processed video: ${video.title}`);
        } catch (error) {
          failureCount++;
          console.error(`✗ Failed to process video: ${video.title}`);
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.error(`  Error: ${errorMessage}`);
        }
      }

      console.log(`\n========================================`);
      console.log(`Channel processing complete: ${channel.channelName}`);
      console.log(`Success: ${successCount} | Failed: ${failureCount}`);
      console.log(`========================================\n`);

      if (successCount === 0) {
        throw new Error(
          `Failed to extract any transcripts from channel ${channel.channelName} (${failureCount} video(s) failed)`,
        );
      }
    } catch (error) {
      console.error(`Error processing channel ${channel.channelName}:`, error);
      throw error;
    }
  }

  /**
   * Extract transcripts from all configured channels
   * @param channels - Array of channel configurations
   */
  async extractAll(channels: ChannelConfig[]) {
    console.log(
      `\n🚀 Starting transcript extraction for ${channels.length} channel(s)...\n`,
    );

    const startTime = Date.now();
    let totalSuccess = 0;
    let totalFailure = 0;

    for (const channel of channels) {
      try {
        await this.extractChannelTranscripts(channel);
        totalSuccess++;
      } catch (error) {
        totalFailure++;
        console.error(
          `Total failed: ${totalFailure} to process channel: ${channel.channelName}`,
          error,
        );
      }
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log(`\n========================================`);
    console.log(`🎉 Extraction complete!`);
    console.log(`Total channels processed: ${totalSuccess}/${channels.length}`);
    console.log(`Total time: ${duration}s`);
    console.log(`========================================\n`);
  }

  /**
   * Save a transcription to the database
   * @param videoData - The video with transcript data
   * @param transcriptionSummary - Optional summary of the transcription
   * @returns The inserted ID or null on error
   */
  async addTranscription(
    videoData: VideoWithTranscript,
    transcriptionSummary?: string,
  ): Promise<number | null> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      const stmt = db.prepare(`
        INSERT INTO youtube_transcriptions (
          channel_id, channel_name, video_title, posted_at, video_url,
          processed_at, transcription_text, transcription_summary
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        [
          videoData.channel.id,
          videoData.channel.name,
          videoData.title,
          videoData.publishedAt !== 'Unknown' ? videoData.publishedAt : null,
          videoData.url,
          new Date().toISOString(),
          videoData.transcriptText,
          transcriptionSummary || null,
        ],
        function (this: { lastID?: number }, err: Error | null) {
          if (err) {
            const errorWithCode = err as Error & { code?: string };
            if (
              err.message.includes('UNIQUE constraint failed') ||
              err.message.includes('duplicate key value') ||
              errorWithCode.code === '23505'
            ) {
              console.log(
                `Transcription already exists for video: ${videoData.title}`,
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
   * Get all transcriptions from the database
   * @returns Array of all transcription records
   */
  async getAllTranscriptions(): Promise<DBYoutubeTranscription[]> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      db.all(
        `SELECT
           id,
           channel_id AS channelId,
           channel_name AS channelName,
           video_title AS videoTitle,
           posted_at AS postedAt,
           video_url AS videoUrl,
           processed_at AS processedAt,
           transcription_text AS transcriptionText,
           transcription_summary AS transcriptionSummary
           FROM youtube_transcriptions
           ORDER BY processed_at DESC`,
        [],
        (err: Error | null, rows: YoutubeTranscription[]) => {
          if (err) {
            reject(err);
          } else {
            const transcriptions: YoutubeTranscription[] = rows.map((row) => ({
              ...row,
              postedAt: row.postedAt ? new Date(row.postedAt) : undefined,
              processedAt: new Date(row.processedAt),
            }));
            resolve(transcriptions);
          }
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
        return { success: false, error: 'Missing required fields in video data' };
      }

      console.log(`  Summarizing transcription for: ${videoData.title} by ${videoData.channel.name}`);

      const summaryPrompt = this.configService.getTranscriptionSummaryPrompt(
        videoData.transcriptText.substring(0, 8000), // Limit text length
      );

      const summary = await this.aiService.callDeepseekChat(summaryPrompt);

      if (!summary) {
        console.log(
          `  Warning: Failed to generate summary for ${videoData.title}. Saving without summary.`,
        );
      }

      const insertedId = await this.addTranscription(
        videoData,
        summary || undefined,
      );

      if (insertedId === null) {
        return {
          success: false,
          error: 'Transcription already exists or failed to insert',
        };
      }

      console.log(
        `  ✓ Successfully processed and saved transcription (ID: ${insertedId})`,
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
