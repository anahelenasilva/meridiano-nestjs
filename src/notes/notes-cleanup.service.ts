import { DatabaseService } from '@libs/database';
import { Injectable } from '@nestjs/common';
import { NoteSourceType } from './note.entity';

@Injectable()
export class NotesCleanupService {
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Permanently removes every note attached to a source, including
   * soft-deleted history rows, so deleting the parent content cannot leave
   * orphaned records behind. Returns the number of rows removed.
   */
  async purgeNotesForSource(
    sourceType: NoteSourceType,
    sourceId: string,
  ): Promise<number> {
    const db = this.databaseService.getDbConnection();

    return new Promise((resolve, reject) => {
      db.run(
        `DELETE FROM notes WHERE source_type = ? AND source_id = ?`,
        [sourceType, sourceId],
        function (err: Error | null) {
          if (err) {
            reject(err);
            return;
          }

          resolve(this.changes ?? 0);
        },
      );
    });
  }
}
