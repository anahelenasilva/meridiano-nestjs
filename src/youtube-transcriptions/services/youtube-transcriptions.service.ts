import { DatabaseService } from '@libs/database';
import { QueueService } from '@libs/queue';
import { Injectable } from '@nestjs/common';
import { ChannelConfig } from '../../shared/types/channel';
import { TranscriptItem, VideoWithTranscript } from '../../shared/types/video';
import { YoutubeChannelsService } from '../../youtube-channels/youtube-channels.service';
import { CountTotalTranscriptionsInput } from '../dto/count-total-transcriptionsinput.dto';
import { PaginatedYoutubeTranscriptionInput } from "../dto/paginated-youtub-transcription-input.dto";
import {
  DBYoutubeTranscription,
  YoutubeTranscription,
} from '../entities/youtube-transcription.entity';
import { StorageService } from '../services/storage.service';
import { TranscriptService } from '../services/transcript.service';
import { YoutubeTranscriptionsAlternativeService } from './youtube-transcriptions-alternative.service';
import { fetchTranscriptViaInnertube } from './youtube-transcriptions-innertube.service';
import { YouTubeService } from './youtube.service';

type YouTubeTranscriptSegment = {
  end_ms: string;
  snippet: {
    text: string;
  };
  start_ms: string;
  start_time_text: {
    text: string;
  };
};

/**
 * Convert YouTube transcript segments to TranscriptItem format
 * @param segments - Array of YouTube transcript segments
 * @returns Array of TranscriptItem
 */
const convertYouTubeSegmentsToTranscriptItems = (
  segments: YouTubeTranscriptSegment[],
): TranscriptItem[] => {
  return segments.map((segment) => {
    const startMs = Number(segment.start_ms);
    const endMs = Number(segment.end_ms);
    return {
      text: segment.snippet.text,
      duration: endMs - startMs,
      offset: startMs,
    };
  });
};

@Injectable()
export class YoutubeTranscriptionsService {
  constructor(
    private readonly youtubeService: YouTubeService,
    private readonly transcriptService: TranscriptService,
    private readonly youtubeTranscriptionsAlternativeService: YoutubeTranscriptionsAlternativeService,
    private readonly storageService: StorageService,
    private readonly databaseService: DatabaseService,
    private readonly queueService: QueueService,
    private readonly youtubeChannelsService: YoutubeChannelsService,
  ) { }

  /**
   * Extract transcripts from videos in a single channel
   * @param channel - The channel configuration
   */
  async extractChannelTranscripts(channel: ChannelConfig) {
    console.log(`\n========================================`);
    console.log(`Processing channel: `, {
      channelName: channel.channelName,
      maxVideos: channel.maxVideos
    });

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

          // Get transcript with fallback mechanism
          let transcript: TranscriptItem[] = [];

          try {
            // Try alternative service first (youtube-transcript-plus)
            console.log('Attempting to fetch transcript using alternative service...');
            transcript = await this.youtubeTranscriptionsAlternativeService.fetchTranscript(video.videoId);

            if (!transcript || transcript.length === 0) {
              throw new Error('Alternative service returned empty transcript');
            }

            console.log(`✓ Successfully fetched transcript using alternative service (${transcript.length} items)`);
          } catch (alternativeServiceError) {
            // Fallback to primary method (TranscriptService)
            console.log('Alternative service failed, attempting primary method...');
            const alternativeServiceErrorMessage = alternativeServiceError instanceof Error ? alternativeServiceError.message : String(alternativeServiceError);
            console.log(`  Alternative service error: ${alternativeServiceErrorMessage}`);

            try {
              console.log('Attempting to fetch transcript using primary method...');
              transcript = await this.transcriptService.getTranscript(video.videoId);

              if (!transcript || transcript.length === 0) {
                throw new Error('Primary method returned empty transcript');
              }

              console.log(`✓ Successfully fetched transcript using primary method (${transcript.length} items)`);
            } catch (primaryError) {
              // Fallback to innertube method
              console.log('Primary method failed, attempting innertube method...');
              const primaryErrorMessage = primaryError instanceof Error ? primaryError.message : String(primaryError);
              console.log(`  Primary error: ${primaryErrorMessage}`);

              try {
                const innertubeSegments = await fetchTranscriptViaInnertube(video.videoId);
                transcript = convertYouTubeSegmentsToTranscriptItems(innertubeSegments);

                if (!transcript || transcript.length === 0) {
                  throw new Error('Innertube method returned empty transcript');
                }

                console.log(`✓ Successfully fetched transcript using innertube method (${transcript.length} items)`);
              } catch (innertubeError) {
                // All three methods failed
                const innertubeErrorMessage = innertubeError instanceof Error ? innertubeError.message : String(innertubeError);
                console.error('All transcript methods failed:');
                console.error(`  Alternative service: ${alternativeServiceErrorMessage}`);
                console.error(`  Primary: ${primaryErrorMessage}`);
                console.error(`  Innertube: ${innertubeErrorMessage}`);

                throw new Error(
                  `Failed to fetch transcript using all methods. Alternative service: ${alternativeServiceErrorMessage}. Primary: ${primaryErrorMessage}. Innertube: ${innertubeErrorMessage}`
                );
              }
            }
          }

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
      console.log(`Channel processing complete: `, {
        channelName: channel.channelName,
        success: successCount,
        failed: failureCount
      });

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
   * Process a single video URL and save its transcription
   * @param videoUrl - The YouTube video URL
   * @param channelId - The channel ID from config
   * @param proxyUrl - Optional proxy URL for transcript fetching
   * @returns The transcription ID or null if video already exists
   */
  async processSingleVideoUrl(
    videoUrl: string,
    channelId: string,
    proxyUrl?: string,
  ): Promise<string | null> {
    try {
      console.log(`\n========================================`);
      console.log(`Processing single video: ${videoUrl}`);

      const channelConfig = await this.youtubeChannelsService.getChannelById(channelId);

      if (!channelConfig) {
        throw new Error(`Channel ${channelId} not found in configuration`);
      }

      if (channelConfig.enabled === false) {
        throw new Error(`Channel ${channelId} is disabled`);
      }

      const { extractVideoId } = await import('../helpers/extract-video-id.js');
      const videoId = extractVideoId(videoUrl);

      if (!videoId) {
        throw new Error('Invalid YouTube URL or unable to extract video ID');
      }

      const videoMetadata = await this.youtubeService.getVideoMetadata(
        videoId,
        channelId,
        channelConfig.name,
        channelConfig.description || '',
        channelConfig.id
      );

      // Get transcript with fallback mechanism
      let transcript: TranscriptItem[] = [];

      try {
        // Try alternative service first (youtube-transcript-plus)
        console.log('Attempting to fetch transcript using alternative service...');
        transcript = await this.youtubeTranscriptionsAlternativeService.fetchTranscript(videoId);

        if (!transcript || transcript.length === 0) {
          throw new Error('Alternative service returned empty transcript');
        }

        console.log(`✓ Successfully fetched transcript using alternative service (${transcript.length} items)`);
      } catch (alternativeServiceError) {
        // Fallback to primary method (TranscriptService)
        console.log('Alternative service failed, attempting primary method...');
        const alternativeServiceErrorMessage = alternativeServiceError instanceof Error ? alternativeServiceError.message : String(alternativeServiceError);
        console.log(`  Alternative service error: ${alternativeServiceErrorMessage}`);

        try {
          console.log('Attempting to fetch transcript using primary method...');
          transcript = await this.transcriptService.getTranscript(videoId);

          if (!transcript || transcript.length === 0) {
            throw new Error('Primary method returned empty transcript');
          }

          console.log(`✓ Successfully fetched transcript using primary method (${transcript.length} items)`);
        } catch (primaryError) {
          // Fallback to innertube method
          console.log('Primary method failed, attempting innertube method...');
          const primaryErrorMessage = primaryError instanceof Error ? primaryError.message : String(primaryError);
          console.log(`  Primary error: ${primaryErrorMessage}`);

          try {
            const innertubeSegments = await fetchTranscriptViaInnertube(videoId, proxyUrl);
            transcript = convertYouTubeSegmentsToTranscriptItems(innertubeSegments);

            if (!transcript || transcript.length === 0) {
              throw new Error('Innertube method returned empty transcript');
            }

            console.log(`✓ Successfully fetched transcript using innertube method (${transcript.length} items)`);
          } catch (innertubeError) {
            // All three methods failed
            const innertubeErrorMessage = innertubeError instanceof Error ? innertubeError.message : String(innertubeError);
            console.error('All transcript methods failed:');
            console.error(`  Alternative service: ${alternativeServiceErrorMessage}`);
            console.error(`  Primary: ${primaryErrorMessage}`);
            console.error(`  Innertube: ${innertubeErrorMessage}`);

            throw new Error(
              `Failed to fetch transcript using all methods. Alternative service: ${alternativeServiceErrorMessage}. Primary: ${primaryErrorMessage}. Innertube: ${innertubeErrorMessage}`
            );
          }
        }
      }

      const transcriptText =
        this.transcriptService.transcriptToText(transcript);

      const videoWithTranscript: VideoWithTranscript = {
        ...videoMetadata,
        transcript,
        transcriptText,
      };

      await this.storageService.saveTranscript(
        channelId,
        videoWithTranscript,
      );

      // Save transcription to database first without summary
      const transcriptionId = await this.addTranscription(videoWithTranscript);

      if (transcriptionId === null) {
        console.log('Video already exists in database');
        return null;
      }

      console.log(`Enqueueing summary generation for transcription ID ${transcriptionId}...`);
      await this.queueService.addTranscriptionSummaryJob(
        transcriptionId,
        transcriptText.substring(0, 8000), // Limit text length
        videoWithTranscript.title,
      );

      console.log(
        `✓ Successfully processed video: ${videoMetadata.title} (ID: ${transcriptionId})`,
      );
      console.log(`========================================\n`);

      return transcriptionId;
    } catch (error) {
      console.error(`Error processing video URL ${videoUrl}:`, error);
      throw error;
    }
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
  ): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      const stmt = db.prepare(`
        INSERT INTO youtube_transcriptions (
          channel_id, channel_name, video_title, posted_at, video_url,
          processed_at, transcription_text, transcription_summary, thumbnail_url
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        [
          videoData.channel.databaseId,
          videoData.channel.name,
          videoData.title,
          videoData.publishedAt !== 'Unknown' ? videoData.publishedAt : null,
          videoData.url,
          new Date().toISOString(),
          videoData.transcriptText,
          transcriptionSummary || null,
          videoData.thumbnailUrl || null,
        ],
        function (this: { lastID?: string }, err: Error | null) {
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
   * Update transcription summary in the database
   * @param transcriptionId - The transcription ID
   * @param summary - The summary text to save
   * @returns Promise that resolves when update is complete
   */
  async updateTranscriptionSummary(
    transcriptionId: string,
    summary: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      const stmt = db.prepare(`
        UPDATE youtube_transcriptions
        SET transcription_summary = ?
        WHERE id = ?
      `);

      stmt.run([summary, transcriptionId], function (err: Error | null) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
        stmt.finalize();
      });
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
           channel_id AS "channelId",
           channel_name AS "channelName",
           video_title AS "videoTitle",
           posted_at AS "postedAt",
           video_url AS "videoUrl",
           processed_at AS "processedAt",
           transcription_text AS "transcriptionText",
           transcription_summary AS "transcriptionSummary",
           thumbnail_url AS "thumbnailUrl"
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

      const transcriptAlreadyExists = await this.getTranscriptionByVideoUrl(videoData.url);
      if (transcriptAlreadyExists) {
        return {
          success: false,
          error: `Transcription already exists for video: ${videoData.title}`,
        };
      }

      console.log(`  Processing transcription for: ${videoData.title} by ${videoData.channel.name}`);

      // Save transcription to database first without summary
      const insertedId = await this.addTranscription(videoData);

      if (insertedId === null) {
        return {
          success: false,
          error: 'Transcription already exists or failed to insert',
        };
      }

      console.log(`  Enqueueing summary generation for transcription ID ${insertedId}...`);
      await this.queueService.addTranscriptionSummaryJob(
        insertedId,
        videoData.transcriptText.substring(0, 8000), // Limit text length
        videoData.title,
      );

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
  async getTranscriptionById(id: string): Promise<YoutubeTranscription | null> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      const query = `
        SELECT
          id,
          channel_id AS "channelId",
          channel_name AS "channelName",
          video_title AS "videoTitle",
          posted_at AS "postedAt",
          video_url AS "videoUrl",
          processed_at AS "processedAt",
          transcription_text AS "transcriptionText",
          transcription_summary AS "transcriptionSummary",
          thumbnail_url AS "thumbnailUrl"
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

  async getTranscriptionByVideoUrl(videoUrl: string): Promise<YoutubeTranscription | null> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();
      db.get('SELECT * FROM youtube_transcriptions WHERE video_url = ?', [videoUrl], (err: Error | null, row: YoutubeTranscription | undefined) => {
        if (err) {
          reject(err);
        } else {
          resolve(row || null);
        }
      });
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
          channel_id AS "channelId",
          channel_name AS "channelName",
          video_title AS "videoTitle",
          posted_at AS "postedAt",
          video_url AS "videoUrl",
          processed_at AS "processedAt",
          transcription_text AS "transcriptionText",
          transcription_summary AS "transcriptionSummary",
          thumbnail_url AS "thumbnailUrl"
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

  async delete(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();
      const stmt = db.prepare(`DELETE FROM youtube_transcriptions WHERE id = ?`);

      stmt.run([id], function (err) {
        if (err) {
          console.error('Error deleting youtube_transcriptions:', err);
          reject(err);
        } else {
          resolve();
        }

        stmt.finalize();
      });
    });
  }
}
