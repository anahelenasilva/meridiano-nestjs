import { DatabaseService } from '@libs/database';
import { Injectable } from '@nestjs/common';
import {
  mapRowToNote,
  Note,
  NoteRow,
  NoteSourceType,
} from './note.entity';

/**
 * Read-only access to notes.
 *
 * Lives in its own module (`NotesReadModule`) with no dependency on
 * `ArticlesModule`/`YoutubeTranscriptionsModule`, so read consumers such as the
 * owner-facing Article detail query can embed the active note without creating a
 * circular module dependency with the write-path `NotesService`.
 */
@Injectable()
export class NotesReadService {
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Returns the single active (non-soft-deleted) note owned by `userId` for the
   * given resource, or `null` when none exists.
   */
  async getActiveNote(
    userId: string,
    sourceType: NoteSourceType,
    sourceId: string,
  ): Promise<Note | null> {
    const db = this.databaseService.getDbConnection();

    return new Promise((resolve, reject) => {
      db.get(
        `
          SELECT id, user_id, source_type, source_id, content, created_at, updated_at
          FROM notes
          WHERE user_id = ? AND source_type = ? AND source_id = ? AND deleted_at IS NULL
          LIMIT 1
        `,
        [userId, sourceType, sourceId],
        (err: Error | null, row?: NoteRow) => {
          if (err) {
            reject(err);
            return;
          }

          resolve(row ? mapRowToNote(row) : null);
        },
      );
    });
  }
}
