import {
  DatabaseService,
  execute,
  queryAll,
  queryOne,
  SqlParams,
} from '@libs/database';
import { Injectable, NotFoundException } from '@nestjs/common';
import { AudioFilesCleanupService } from '../../audio-files/audio-files-cleanup.service';
import { NotesCleanupService } from '../../notes/notes-cleanup.service';
import { CountTotalTranscriptionsInput } from '../dto/count-total-transcriptionsinput.dto';
import { PaginatedYoutubeTranscriptionInput } from '../dto/paginated-youtub-transcription-input.dto';
import {
  DBYoutubeTranscription,
  YoutubeTranscription,
} from '../entities/youtube-transcription.entity';

// channelName and channelExternalId come from the channels join, since
// youtube_transcriptions stores only the channel FK. The lean set skips the
// transcript text, the heaviest column, and the thumbnail a terminal can't show.
const TRANSCRIPTION_LEAN_COLUMNS = `
  yt.id,
  yt.channel_id AS "channelId",
  c.name AS "channelName",
  c.channel_id AS "channelExternalId",
  yt.video_title AS "videoTitle",
  yt.posted_at AS "postedAt",
  yt.video_url AS "videoUrl",
  yt.processed_at AS "processedAt",
  yt.transcription_summary AS "transcriptionSummary",
  yt.custom_prompt
`;

const TRANSCRIPTION_COLUMNS = `
  ${TRANSCRIPTION_LEAN_COLUMNS},
  yt.transcription_text AS "transcriptionText",
  yt.thumbnail_url AS "thumbnailUrl"
`;

const TRANSCRIPTION_FROM_JOIN = `
  FROM youtube_transcriptions yt
  JOIN youtube_channels c ON c.id = yt.channel_id
`;

// A correlated subquery, so only the list reads select it.
const HAS_AUDIO = `
  EXISTS (
    SELECT 1 FROM audio_files af
    WHERE af.source_type = 'transcription' AND af.source_id = yt.id
  ) AS has_audio
`;

const TRANSCRIPTION_LIST_COLUMNS = `${TRANSCRIPTION_COLUMNS}, ${HAS_AUDIO}`;

// Per-query read model: has_audio is derived (EXISTS against audio_files),
// not a schema column, so it lives here rather than on DBYoutubeTranscription.
export type YoutubeTranscriptionListRow = DBYoutubeTranscription & {
  has_audio: boolean;
};

export type LeanTranscriptionListRow = Omit<
  YoutubeTranscriptionListRow,
  'transcriptionText' | 'thumbnailUrl'
>;

export type TranscriptionFilter = {
  // The internal channel uuid or the YouTube channel id (UC...); `meridiano
  // channels` has printed each at different times, so both match.
  channelId?: string;
  startDate?: string;
  endDate?: string;
};

export type TranscriptionPage = {
  page: number;
  perPage: number;
};

// posted_at is null when YouTube gave no publish date; those rows date by
// when Meridiano processed them, matching the RSS feed's pubDate. posted_at is
// a TEXT column holding toISOString() output; the ::timestamp cast drops its
// "Z" and leaves UTC wall time, the same as processed_at (TIMESTAMP).
const TRANSCRIPTION_DATE = 'COALESCE(yt.posted_at::timestamp, yt.processed_at)';

function compileTranscriptionFilter(filter: TranscriptionFilter): {
  where: string;
  params: SqlParams;
} {
  const clauses: string[] = [];
  const params: SqlParams = [];

  if (filter.channelId) {
    // ::text keeps a UC... id from failing the uuid cast.
    clauses.push('(yt.channel_id::text = ? OR c.channel_id = ?)');
    params.push(filter.channelId, filter.channelId);
  }

  if (filter.startDate) {
    clauses.push(`DATE(${TRANSCRIPTION_DATE}) >= ?`);
    params.push(filter.startDate);
  }

  if (filter.endDate) {
    clauses.push(`DATE(${TRANSCRIPTION_DATE}) <= ?`);
    params.push(filter.endDate);
  }

  return {
    where: clauses.length > 0 ? clauses.join(' AND ') : 'TRUE',
    params,
  };
}

@Injectable()
export class YoutubeTranscriptionsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly notesCleanupService: NotesCleanupService,
    private readonly audioFilesCleanupService: AudioFilesCleanupService,
  ) {}

  /**
   * Which of these canonical video URLs already have a row. Used by the enqueue
   * command so a bulk paste reports duplicates before queueing anything.
   */
  async findExistingVideoUrls(urls: string[]): Promise<Set<string>> {
    if (urls.length === 0) {
      return new Set();
    }

    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();
      const placeholders = urls.map(() => '?').join(', ');

      db.all(
        `SELECT video_url FROM youtube_transcriptions WHERE video_url IN (${placeholders})`,
        urls,
        (err: Error | null, rows: { video_url: string }[]) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(new Set((rows ?? []).map((row) => row.video_url)));
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
  async getAllTranscriptions(): Promise<YoutubeTranscriptionListRow[]> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      db.all(
        `SELECT ${TRANSCRIPTION_LIST_COLUMNS} ${TRANSCRIPTION_FROM_JOIN}
           ORDER BY yt.processed_at DESC`,
        [],
        (err: Error | null, rows: YoutubeTranscriptionListRow[]) => {
          if (err) {
            reject(err);
          } else {
            // Postgres returns EXISTS as a real boolean (see youtube_channels.enabled
            // for the same driver behavior on a plain boolean column), so no coercion.
            const transcriptions: YoutubeTranscriptionListRow[] = rows.map(
              (row) => ({
                ...row,
                postedAt: row.postedAt ? new Date(row.postedAt) : undefined,
                processedAt: new Date(row.processedAt),
                has_audio: row.has_audio,
              }),
            );
            resolve(transcriptions);
          }
        },
      );
    });
  }

  /**
   * One lean page of transcriptions, newest first, plus the total for the
   * whole filter.
   */
  async listTranscriptions(
    filter: TranscriptionFilter,
    { page, perPage }: TranscriptionPage,
  ): Promise<{ transcriptions: LeanTranscriptionListRow[]; total: number }> {
    const db = this.databaseService.getDbConnection();
    const { where, params } = compileTranscriptionFilter(filter);
    const offset = (page - 1) * perPage;

    const [rows, countRow] = await Promise.all([
      queryAll<LeanTranscriptionListRow>(
        db,
        `SELECT ${TRANSCRIPTION_LEAN_COLUMNS}, ${HAS_AUDIO} ${TRANSCRIPTION_FROM_JOIN}
         WHERE ${where}
         ORDER BY ${TRANSCRIPTION_DATE} DESC, yt.id DESC
         LIMIT ? OFFSET ?`,
        [...params, perPage, offset],
      ),
      // pg returns COUNT(*) as a bigint string.
      queryOne<{ count: string }>(
        db,
        `SELECT COUNT(*) AS count ${TRANSCRIPTION_FROM_JOIN} WHERE ${where}`,
        params,
      ),
    ]);

    return {
      transcriptions: rows.map((row) => ({
        ...row,
        postedAt: row.postedAt ? new Date(row.postedAt) : undefined,
        processedAt: new Date(row.processedAt),
      })),
      total: Number(countRow?.count ?? 0),
    };
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
    const changes = await execute(
      this.databaseService.getDbConnection(),
      'DELETE FROM youtube_transcriptions WHERE id = ?',
      [id],
    );

    if (changes === 0) {
      throw new NotFoundException('YouTube transcription not found');
    }

    await this.notesCleanupService.purgeNotesForSource('transcription', id);
    await this.audioFilesCleanupService.purgeAudioForSource(
      'transcription',
      id,
    );
  }
}
