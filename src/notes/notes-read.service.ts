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

  /**
   * Returns the active (non-soft-deleted) notes owned by `userId` for the given
   * `sourceType` and collection of `sourceId`s, keyed by `source_id`.
   *
   * Runs a single query regardless of how many ids are requested, so callers can
   * embed notes onto a page of items without an N+1 lookup pattern. Ids with no
   * active note are simply absent from the returned map. The unique active-note
   * index guarantees at most one active note per `(user, source_type, source_id)`,
   * so keying by `source_id` never collides. An empty `sourceIds` short-circuits
   * to an empty map without touching the database.
   */
  async getActiveNotesBySourceIds(
    userId: string,
    sourceType: NoteSourceType,
    sourceIds: readonly string[],
  ): Promise<Map<string, Note>> {
    if (sourceIds.length === 0) {
      return new Map();
    }

    // De-duplicate so a page with repeated ids still binds a clean id array.
    const uniqueSourceIds = [...new Set(sourceIds)];
    const db = this.databaseService.getDbConnection();

    return new Promise((resolve, reject) => {
      db.all(
        `
          SELECT id, user_id, source_type, source_id, content, created_at, updated_at
          FROM notes
          WHERE user_id = ? AND source_type = ? AND source_id = ANY(?::uuid[]) AND deleted_at IS NULL
        `,
        [userId, sourceType, uniqueSourceIds],
        (err: Error | null, rows?: NoteRow[]) => {
          if (err) {
            reject(err);
            return;
          }

          const notesBySourceId = new Map<string, Note>();
          for (const row of rows ?? []) {
            const note = mapRowToNote(row);
            notesBySourceId.set(note.source_id, note);
          }

          resolve(notesBySourceId);
        },
      );
    });
  }
}
