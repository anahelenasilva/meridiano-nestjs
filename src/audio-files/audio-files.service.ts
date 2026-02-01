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

@Injectable()
export class AudioFilesService {
  constructor(private readonly databaseService: DatabaseService) { }

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
        [sourceType, sourceId, s3Bucket, s3Key, fileSizeBytes, durationSeconds ?? null],
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

      db.get(query, [sourceType, sourceId], (err, row: AudioFileRow | undefined) => {
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
      });
    });
  }
}
