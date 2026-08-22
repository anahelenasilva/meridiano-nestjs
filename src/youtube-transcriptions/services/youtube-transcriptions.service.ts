import { DatabaseService } from '@libs/database';
import { QueueService } from '@libs/queue';
import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { AudioFilesCleanupService } from '../../audio-files/audio-files-cleanup.service';
import { NotesCleanupService } from '../../notes/notes-cleanup.service';
import { ChannelConfig } from '../../shared/types/channel';
import { TranscriptItem, VideoWithTranscript } from '../../shared/types/video';
import { YoutubeChannelsService } from '../../youtube-channels/youtube-channels.service';
import { CountTotalTranscriptionsInput } from '../dto/count-total-transcriptionsinput.dto';
import { PaginatedYoutubeTranscriptionInput } from '../dto/paginated-youtub-transcription-input.dto';
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

// Shared projection for transcription reads. channel_name and the external
// channel id come from the joined channels table now that youtube_transcriptions
// only stores the internal channel UUID (the FK). Kept in one place so the
// column set changes in a single site rather than across every read query.
const TRANSCRIPTION_COLUMNS = `
  yt.id,
  yt.channel_id AS "channelId",
  c.name AS "channelName",
  c.channel_id AS "channelExternalId",
  yt.video_title AS "videoTitle",
  yt.posted_at AS "postedAt",
  yt.video_url AS "videoUrl",
  yt.processed_at AS "processedAt",
  yt.transcription_text AS "transcriptionText",
  yt.transcription_summary AS "transcriptionSummary",
  yt.thumbnail_url AS "thumbnailUrl",
  yt.custom_prompt
`;

const TRANSCRIPTION_FROM_JOIN = `
  FROM youtube_transcriptions yt
  JOIN youtube_channels c ON c.id = yt.channel_id
`;

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
  private readonly logger = new Logger(YoutubeTranscriptionsService.name);

  constructor(
    private readonly youtubeService: YouTubeService,
    private readonly transcriptService: TranscriptService,
    private readonly youtubeTranscriptionsAlternativeService: YoutubeTranscriptionsAlternativeService,
    private readonly storageService: StorageService,
    private readonly databaseService: DatabaseService,
    @Inject(forwardRef(() => QueueService))
    private readonly queueService: QueueService,
    private readonly youtubeChannelsService: YoutubeChannelsService,
    private readonly notesCleanupService: NotesCleanupService,
    private readonly audioFilesCleanupService: AudioFilesCleanupService,
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

          // Get transcript with fallback mechanism
          let transcript: TranscriptItem[] = [];

          try {
            // Try alternative service first (youtube-transcript-plus)
            this.logger.log(
              `Attempting to fetch transcript using alternative service... [videoId=${video.videoId}]`,
            );
            transcript =
              await this.youtubeTranscriptionsAlternativeService.fetchTranscript(
                video.videoId,
              );

            if (!transcript || transcript.length === 0) {
              throw new Error('Alternative service returned empty transcript');
            }

            this.logger.log(
              `✓ Successfully fetched transcript using alternative service (${transcript.length} items) [videoId=${video.videoId}]`,
            );
          } catch (alternativeServiceError) {
            // Fallback to primary method (TranscriptService)
            this.logger.log(
              `Alternative service failed, attempting primary method... [videoId=${video.videoId}]`,
            );
            const alternativeServiceErrorMessage =
              alternativeServiceError instanceof Error
                ? alternativeServiceError.message
                : String(alternativeServiceError);
            this.logger.log(
              `  Alternative service error: ${alternativeServiceErrorMessage} [videoId=${video.videoId}]`,
            );

            try {
              this.logger.log(
                `Attempting to fetch transcript using primary method... [videoId=${video.videoId}]`,
              );
              transcript = await this.transcriptService.getTranscript(
                video.videoId,
              );

              if (!transcript || transcript.length === 0) {
                throw new Error('Primary method returned empty transcript');
              }

              this.logger.log(
                `✓ Successfully fetched transcript using primary method (${transcript.length} items) [videoId=${video.videoId}]`,
              );
            } catch (primaryError) {
              // Fallback to innertube method
              this.logger.log(
                `Primary method failed, attempting innertube method... [videoId=${video.videoId}]`,
              );
              const primaryErrorMessage =
                primaryError instanceof Error
                  ? primaryError.message
                  : String(primaryError);
              this.logger.log(
                `  Primary error: ${primaryErrorMessage} [videoId=${video.videoId}]`,
              );

              try {
                const innertubeSegments = await fetchTranscriptViaInnertube(
                  video.videoId,
                );
                transcript =
                  convertYouTubeSegmentsToTranscriptItems(innertubeSegments);

                if (!transcript || transcript.length === 0) {
                  throw new Error('Innertube method returned empty transcript');
                }

                this.logger.log(
                  `✓ Successfully fetched transcript using innertube method (${transcript.length} items) [videoId=${video.videoId}]`,
                );
              } catch (innertubeError) {
                // All three methods failed
                const innertubeErrorMessage =
                  innertubeError instanceof Error
                    ? innertubeError.message
                    : String(innertubeError);
                this.logger.error(
                  `All transcript methods failed [videoId=${video.videoId}]: alternative service: ${alternativeServiceErrorMessage}. Primary: ${primaryErrorMessage}. Innertube: ${innertubeErrorMessage}`,
                );

                throw new Error(
                  `Failed to fetch transcript using all methods. Alternative service: ${alternativeServiceErrorMessage}. Primary: ${primaryErrorMessage}. Innertube: ${innertubeErrorMessage}`,
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
   * Extract transcripts from all configured channels
   * @param channels - Array of channel configurations
   */
  async extractAll(channels: ChannelConfig[]) {
    this.logger.log(
      `🚀 Starting transcript extraction for ${channels.length} channel(s)...`,
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
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Total failed: ${totalFailure} to process channel: ${channel.channelName} [channelId=${channel.channelId}]: ${errorMessage}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    this.logger.log(
      `🎉 Extraction complete! Total channels processed: ${totalSuccess}/${channels.length}, total time: ${duration}s`,
    );
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

      const { extractVideoId } = await import('../helpers/extract-video-id.js');
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

      // Get transcript with fallback mechanism
      let transcript: TranscriptItem[] = [];

      try {
        // Try alternative service first (youtube-transcript-plus)
        this.logger.log(
          `Attempting to fetch transcript using alternative service... [videoId=${videoId}, channelId=${channelDbId}]`,
        );
        transcript =
          await this.youtubeTranscriptionsAlternativeService.fetchTranscript(
            videoId,
          );

        if (!transcript || transcript.length === 0) {
          throw new Error('Alternative service returned empty transcript');
        }

        this.logger.log(
          `✓ Successfully fetched transcript using alternative service (${transcript.length} items) [videoId=${videoId}]`,
        );
      } catch (alternativeServiceError) {
        // Fallback to primary method (TranscriptService)
        this.logger.log(
          `Alternative service failed, attempting primary method... [videoId=${videoId}, channelId=${channelDbId}]`,
        );
        const alternativeServiceErrorMessage =
          alternativeServiceError instanceof Error
            ? alternativeServiceError.message
            : String(alternativeServiceError);
        this.logger.log(
          `  Alternative service error: ${alternativeServiceErrorMessage} [videoId=${videoId}]`,
        );

        try {
          this.logger.log(
            `Attempting to fetch transcript using primary method... [videoId=${videoId}, channelId=${channelDbId}]`,
          );
          transcript = await this.transcriptService.getTranscript(videoId);

          if (!transcript || transcript.length === 0) {
            throw new Error('Primary method returned empty transcript');
          }

          this.logger.log(
            `✓ Successfully fetched transcript using primary method (${transcript.length} items) [videoId=${videoId}]`,
          );
        } catch (primaryError) {
          // Fallback to innertube method
          this.logger.log(
            `Primary method failed, attempting innertube method... [videoId=${videoId}, channelId=${channelDbId}]`,
          );
          const primaryErrorMessage =
            primaryError instanceof Error
              ? primaryError.message
              : String(primaryError);
          this.logger.log(
            `  Primary error: ${primaryErrorMessage} [videoId=${videoId}]`,
          );

          try {
            const innertubeSegments = await fetchTranscriptViaInnertube(
              videoId,
              proxyUrl,
            );
            transcript =
              convertYouTubeSegmentsToTranscriptItems(innertubeSegments);

            if (!transcript || transcript.length === 0) {
              throw new Error('Innertube method returned empty transcript');
            }

            this.logger.log(
              `✓ Successfully fetched transcript using innertube method (${transcript.length} items) [videoId=${videoId}]`,
            );
          } catch (innertubeError) {
            // All three methods failed
            const innertubeErrorMessage =
              innertubeError instanceof Error
                ? innertubeError.message
                : String(innertubeError);
            this.logger.error(
              `All transcript methods failed [videoId=${videoId}, channelId=${channelDbId}]: alternative service: ${alternativeServiceErrorMessage}. Primary: ${primaryErrorMessage}. Innertube: ${innertubeErrorMessage}`,
            );

            throw new Error(
              `Failed to fetch transcript using all methods. Alternative service: ${alternativeServiceErrorMessage}. Primary: ${primaryErrorMessage}. Innertube: ${innertubeErrorMessage}`,
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
        `SELECT ${TRANSCRIPTION_COLUMNS} ${TRANSCRIPTION_FROM_JOIN}
           ORDER BY yt.processed_at DESC`,
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

      const transcriptAlreadyExists = await this.getTranscriptionByVideoUrl(
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

  /**
   * Get a single transcription by ID
   * @param id - The transcription ID
   * @returns The transcription or null if not found
   */
  async getTranscriptionById(id: string): Promise<YoutubeTranscription | null> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      const query = `
        SELECT ${TRANSCRIPTION_COLUMNS} ${TRANSCRIPTION_FROM_JOIN}
        WHERE yt.id = ?
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

  async getTranscriptionByVideoUrl(
    videoUrl: string,
  ): Promise<YoutubeTranscription | null> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();
      db.get(
        `SELECT ${TRANSCRIPTION_COLUMNS} ${TRANSCRIPTION_FROM_JOIN}
         WHERE yt.video_url = ?`,
        [videoUrl],
        (err: Error | null, row: YoutubeTranscription | undefined) => {
          if (err) {
            reject(err);
          } else {
            resolve(row || null);
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
        `SELECT DISTINCT yt.channel_id, c.name AS channel_name
         FROM youtube_transcriptions yt
         JOIN youtube_channels c ON c.id = yt.channel_id
         ORDER BY c.name`,
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
        SELECT ${TRANSCRIPTION_COLUMNS} ${TRANSCRIPTION_FROM_JOIN}
        WHERE 1=1
      `;
      const params: (string | number)[] = [];

      if (channel_id) {
        query += ' AND yt.channel_id = ?';
        params.push(channel_id);
      }

      if (channel_name) {
        query += ' AND c.name = ?';
        params.push(channel_name);
      }

      if (search) {
        query +=
          ' AND (yt.video_title LIKE ? OR yt.transcription_text LIKE ? OR yt.transcription_summary LIKE ?)';
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern, searchPattern);
      }

      if (start_date) {
        query += ' AND DATE(yt.posted_at) >= ?';
        params.push(start_date);
      }

      if (end_date) {
        query += ' AND DATE(yt.posted_at) <= ?';
        params.push(end_date);
      }

      // Map the client sort key to a qualified column; channel_name now lives
      // on the joined channels table.
      const sortColumnMap: Record<string, string> = {
        posted_at: 'yt.posted_at',
        video_title: 'yt.video_title',
        processed_at: 'yt.processed_at',
        channel_name: 'c.name',
      };
      const sortColumn = sortColumnMap[sort_by] ?? 'yt.posted_at';
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

      let query = `
        SELECT COUNT(*) as count
        FROM youtube_transcriptions yt
        JOIN youtube_channels c ON c.id = yt.channel_id
        WHERE 1=1`;
      const params: (string | number)[] = [];

      if (channel_id) {
        query += ' AND yt.channel_id = ?';
        params.push(channel_id);
      }

      if (channel_name) {
        query += ' AND c.name = ?';
        params.push(channel_name);
      }

      if (search) {
        query +=
          ' AND (yt.video_title LIKE ? OR yt.transcription_text LIKE ? OR yt.transcription_summary LIKE ?)';
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern, searchPattern);
      }

      if (start_date) {
        query += ' AND DATE(yt.posted_at) >= ?';
        params.push(start_date);
      }

      if (end_date) {
        query += ' AND DATE(yt.posted_at) <= ?';
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
    await new Promise<void>((resolve, reject) => {
      const db = this.databaseService.getDbConnection();
      const stmt = db.prepare(
        `DELETE FROM youtube_transcriptions WHERE id = ?`,
      );

      stmt.run([id], (err) => {
        if (err) {
          this.logger.error(
            `Error deleting youtube_transcriptions [id=${id}]: ${err.message}`,
            err.stack,
          );
          reject(err);
        } else {
          resolve();
        }

        stmt.finalize();
      });
    });

    await this.notesCleanupService.purgeNotesForSource('transcription', id);
    await this.audioFilesCleanupService.purgeAudioForSource(
      'transcription',
      id,
    );
  }
}
