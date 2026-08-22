import { DatabaseService } from '@libs/database';
import { Injectable } from '@nestjs/common';

export interface AudioFile {
  id: string;
  source_type: 'article' | 'transcription';
  source_id: string;
  s3_bucket: string;
  s3_key: string;
  file_size_bytes: number;
  duration_seconds?: number;
  created_at: Date;
}

interface AudioFileRow {
  id: string;
  source_type: 'article' | 'transcription';
  source_id: string;
  s3_bucket: string;
  s3_key: string;
  file_size_bytes: number;
  duration_seconds?: number | null;
  created_at: string;
}

/**
 * One row of the audio library: an audio file joined back to the Article or
 * YouTube Transcription it was generated from.
 */
export interface AudioLibraryEntry {
  audio_id: string;
  source_type: 'article' | 'transcription';
  source_id: string;
  s3_bucket: string;
  s3_key: string;
  file_size_bytes: number;
  duration_seconds?: number;
  created_at: Date;
  title: string;
  source_label: string;
  published_at: string | null;
}

interface AudioLibraryRow {
  audio_id: string;
  source_type: 'article' | 'transcription';
  source_id: string;
  s3_bucket: string;
  s3_key: string;
  file_size_bytes: number;
  duration_seconds?: number | null;
  created_at: string;
  title: string;
  source_label: string;
  published_at: string | null;
}

/**
 * Audio rows are not deleted with their source, so every library read joins
 * back to Articles / YouTube Transcriptions and drops orphaned audio.
 *
 * youtube_transcriptions no longer carries its own channel_name (migration
 * AddChannelFkToTranscriptions dropped it in favor of a channel_id FK), so the
 * transcription's label comes from a further join to youtube_channels.
 */
const AUDIO_LIBRARY_JOIN = `
  FROM audio_files af
  LEFT JOIN articles a
    ON af.source_type = 'article' AND a.id = af.source_id
  LEFT JOIN youtube_transcriptions t
    ON af.source_type = 'transcription' AND t.id = af.source_id
  LEFT JOIN youtube_channels c
    ON c.id = t.channel_id
  WHERE COALESCE(a.id, t.id) IS NOT NULL
`;

@Injectable()
export class AudioFilesService {
  constructor(private readonly databaseService: DatabaseService) {}

  async saveAudioFile(
    sourceType: 'article' | 'transcription',
    sourceId: string,
    s3Bucket: string,
    s3Key: string,
    fileSizeBytes: number,
    durationSeconds?: number,
  ): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      const stmt = db.prepare(`
        INSERT INTO audio_files (source_type, source_id, s3_bucket, s3_key, file_size_bytes, duration_seconds)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        [
          sourceType,
          sourceId,
          s3Bucket,
          s3Key,
          fileSizeBytes,
          durationSeconds ?? null,
        ],
        function (this: { lastID?: string }, err: Error | null) {
          if (err) {
            const errorWithCode = err as Error & { code?: string };
            if (
              err.message.includes('duplicate key value') ||
              errorWithCode.code === '23505' // PostgreSQL unique violation error code
            ) {
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

  async getAudioFileBySource(
    sourceType: 'article' | 'transcription',
    sourceId: string,
  ): Promise<AudioFile | null> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      const query = `
        SELECT * FROM audio_files
        WHERE source_type = ? AND source_id = ?
      `;

      db.get(
        query,
        [sourceType, sourceId],
        (err, row: AudioFileRow | undefined) => {
          if (err) {
            reject(err);
            return;
          }

          if (row) {
            const audioFile: AudioFile = {
              ...row,
              created_at: new Date(row.created_at),
              duration_seconds: row.duration_seconds ?? undefined,
            };
            resolve(audioFile);
          } else {
            resolve(null);
          }
        },
      );
    });
  }

  /**
   * Reads the unified audio library, newest generated audio first.
   * `id` breaks ties so pagination stays stable across pages.
   */
  async listAudioLibrary(limit: number, offset: number): Promise<AudioLibraryEntry[]> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      const query = `
        SELECT
          af.id AS audio_id,
          af.source_type,
          af.source_id,
          af.s3_bucket,
          af.s3_key,
          af.file_size_bytes,
          af.duration_seconds,
          af.created_at,
          COALESCE(a.title, t.video_title) AS title,
          COALESCE(a.feed_source, c.name) AS source_label,
          COALESCE(a.published_date::text, t.posted_at) AS published_at
        ${AUDIO_LIBRARY_JOIN}
        ORDER BY af.created_at DESC, af.id DESC
        LIMIT ? OFFSET ?
      `;

      db.all(
        query,
        [limit, offset],
        (err, rows: AudioLibraryRow[] = []) => {
          if (err) {
            reject(err);
            return;
          }

          resolve(
            rows.map((row) => ({
              ...row,
              created_at: new Date(row.created_at),
              duration_seconds: row.duration_seconds ?? undefined,
            })),
          );
        },
      );
    });
  }

  async countAudioLibrary(): Promise<number> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      db.get(
        `SELECT COUNT(*) AS total ${AUDIO_LIBRARY_JOIN}`,
        [],
        (err, row: { total: number | string } | undefined) => {
          if (err) {
            reject(err);
            return;
          }

          resolve(Number(row?.total ?? 0));
        },
      );
    });
  }
}
