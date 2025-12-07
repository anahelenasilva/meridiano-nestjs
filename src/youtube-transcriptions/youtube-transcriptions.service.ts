import { Injectable } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { ConfigService } from '../config/config.service';
import { DatabaseService } from '../database/database.service';
import { ChannelConfig } from '../shared/types/channel';
import { VideoWithTranscript } from '../shared/types/video';
import {
  CountTotalTranscriptionsInput,
  DBYoutubeTranscription,
  PaginatedYoutubeTranscriptionInput,
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
        return {
          success: false,
          error: 'Missing required fields in video data',
        };
      }

      console.log(`  Summarizing transcription for: ${videoData.title} by ${videoData.channel.name}`);

      const summaryPrompt = this.configService.getTranscriptionSummaryPrompt(
        videoData.transcriptText.substring(0, 8000), // Limit text length
      );

      const summary = await this.aiService.callDeepseekChat(summaryPrompt);

      if (!summary) {
        console.log(`  Warning: Failed to generate summary for ${videoData.title}. Saving without summary.`);
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

      console.log(`  ✓ Successfully processed and saved transcription (ID: ${insertedId})`);
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

  /**
   * Get a single transcription by ID
   * @param id - The transcription ID
   * @returns The transcription or null if not found
   */
  async getTranscriptionById(id: number): Promise<YoutubeTranscription | null> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      const query = `
        SELECT
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
        WHERE id = ?
      `;

      db.get(
        query,
        [id],
        (err: Error | null, row: YoutubeTranscription | undefined) => {
          if (err) {
            reject(err);
            return;
          }

          if (row) {
            const transcription: YoutubeTranscription = {
              ...row,
              postedAt: row.postedAt ? new Date(row.postedAt) : undefined,
              processedAt: new Date(row.processedAt),
            };
            resolve(transcription);
          } else {
            resolve(null);
          }
        },
      );
    });
  }

  /**
   * Get distinct channels (ID and name pairs) from the database
   * @returns Array of unique channels with id and name
   */
  async getDistinctChannels(): Promise<{ id: string; name: string }[]> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      db.all(
        'SELECT DISTINCT channel_id, channel_name FROM youtube_transcriptions ORDER BY channel_name',
        [],
        (
          err: Error | null,
          rows: { channel_id: string; channel_name: string }[],
        ) => {
          if (err) {
            reject(err);
            return;
          }

          resolve(
            rows.map((row) => ({
              id: row.channel_id,
              name: row.channel_name,
            })),
          );
        },
      );
    });
  }

  /**
   * Get paginated transcriptions with filters
   * @param options - Pagination and filter options
   * @returns Array of youtube transcriptions
   */
  async getTranscriptionsPaginated(
    options: PaginatedYoutubeTranscriptionInput,
  ): Promise<YoutubeTranscription[]> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      const {
        page = 1,
        perPage = 20,
        sort_by = 'posted_at',
        direction = 'desc',
        channel_id,
        channel_name,
        search,
        start_date,
        end_date,
      } = options;

      let query = `
        SELECT
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
        WHERE 1=1
      `;
      const params: (string | number)[] = [];

      if (channel_id) {
        query += ' AND channel_id = ?';
        params.push(channel_id);
      }

      if (channel_name) {
        query += ' AND channel_name = ?';
        params.push(channel_name);
      }

      if (search) {
        query +=
          ' AND (video_title LIKE ? OR transcription_text LIKE ? OR transcription_summary LIKE ?)';
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern, searchPattern);
      }

      if (start_date) {
        query += ' AND DATE(posted_at) >= ?';
        params.push(start_date);
      }

      if (end_date) {
        query += ' AND DATE(posted_at) <= ?';
        params.push(end_date);
      }

      const validSortColumns = [
        'posted_at',
        'video_title',
        'processed_at',
        'channel_name',
      ];
      const sortColumn = validSortColumns.includes(sort_by)
        ? sort_by
        : 'posted_at';
      const sortDirection = direction === 'asc' ? 'ASC' : 'DESC';
      query += ` ORDER BY ${sortColumn} ${sortDirection}`;

      const offset = (page - 1) * perPage;
      query += ' LIMIT ? OFFSET ?';
      params.push(perPage, offset);

      db.all(
        query,
        params,
        (err: Error | null, rows: YoutubeTranscription[]) => {
          if (err) {
            reject(err);
            return;
          }

          const transcriptions: YoutubeTranscription[] = rows.map((row) => ({
            ...row,
            postedAt: row.postedAt ? new Date(row.postedAt) : undefined,
            processedAt: new Date(row.processedAt),
          }));

          resolve(transcriptions);
        },
      );
    });
  }

  /**
   * Count total transcriptions with filters
   * @param options - Filter options
   * @returns Total count of matching transcriptions
   */
  async countTotalTranscriptions(
    options: CountTotalTranscriptionsInput,
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      const { channel_id, channel_name, search, start_date, end_date } =
        options;

      let query =
        'SELECT COUNT(*) as count FROM youtube_transcriptions WHERE 1=1';
      const params: (string | number)[] = [];

      if (channel_id) {
        query += ' AND channel_id = ?';
        params.push(channel_id);
      }

      if (channel_name) {
        query += ' AND channel_name = ?';
        params.push(channel_name);
      }

      if (search) {
        query +=
          ' AND (video_title LIKE ? OR transcription_text LIKE ? OR transcription_summary LIKE ?)';
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern, searchPattern);
      }

      if (start_date) {
        query += ' AND DATE(posted_at) >= ?';
        params.push(start_date);
      }

      if (end_date) {
        query += ' AND DATE(posted_at) <= ?';
        params.push(end_date);
      }

      db.get(
        query,
        params,
        (err: Error | null, row: { count: number } | undefined) => {
          if (err) {
            reject(err);
            return;
          }

          resolve(row?.count || 0);
        },
      );
    });
  }
}
