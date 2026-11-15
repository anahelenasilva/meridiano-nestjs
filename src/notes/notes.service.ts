import { DatabaseService } from '@libs/database';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ArticlesService } from '../articles/articles.service';
import { YoutubeTranscriptionsService } from '../youtube-transcriptions/services/youtube-transcriptions.service';
import {
  AppendNoteDto,
  mapRowToNote,
  MAX_NOTE_CONTENT_LENGTH,
  Note,
  NoteRow,
  NoteSourceType,
  SaveNoteDto,
} from './note.entity';
import { NotesReadService } from './notes-read.service';

const NOTE_APPEND_SEPARATOR = '\n\n';

@Injectable()
export class NotesService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly articlesService: ArticlesService,
    private readonly youtubeTranscriptionsService: YoutubeTranscriptionsService,
    private readonly notesReadService: NotesReadService,
  ) {}

  async saveNote(userId: string, input: SaveNoteDto): Promise<Note | null> {
    await this.assertSourceExists(input.source_type, input.source_id);

    if (input.content.trim().length === 0) {
      const activeNote = await this.getActiveNote(
        userId,
        input.source_type,
        input.source_id,
      );
      if (activeNote) {
        await this.softDeleteNote(activeNote.id);
      }
      return null;
    }

    return this.writeActiveNote(userId, input, (activeNote) =>
      this.replaceContent(activeNote.id, input.content),
    );
  }

  // The database does the concatenation so two appends racing on one Note
  // both land, where a read-modify-write would drop one.
  async appendToNote(userId: string, input: AppendNoteDto): Promise<Note> {
    await this.assertSourceExists(input.source_type, input.source_id);

    return this.writeActiveNote(userId, input, (activeNote) => {
      const appendedLength =
        activeNote.content.length +
        NOTE_APPEND_SEPARATOR.length +
        input.content.length;
      if (appendedLength > MAX_NOTE_CONTENT_LENGTH) {
        // An array message matches the ValidationPipe 400 shape in openapi.json.
        throw new BadRequestException([
          `Note would exceed ${MAX_NOTE_CONTENT_LENGTH} characters`,
        ]);
      }
      return this.appendContent(activeNote.id, input.content);
    });
  }

  // Writes to the active Note, or creates it. `writeExisting` returns null when
  // the Note was deleted under it, and a unique violation on insert means
  // another request created it first; both re-read the active Note once.
  private async writeActiveNote(
    userId: string,
    input: SaveNoteDto,
    writeExisting: (activeNote: Note) => Promise<Note | null>,
  ): Promise<Note> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const activeNote = await this.getActiveNote(
        userId,
        input.source_type,
        input.source_id,
      );

      if (activeNote) {
        const written = await writeExisting(activeNote);
        if (written) {
          return written;
        }
        continue;
      }

      try {
        return await this.insertNote(
          userId,
          input.source_type,
          input.source_id,
          input.content,
        );
      } catch (error) {
        if (this.isUniqueViolation(error) && attempt === 0) {
          continue;
        }

        throw error;
      }
    }

    throw new InternalServerErrorException(
      'Failed to save note after retrying concurrent write',
    );
  }

  private async assertSourceExists(
    sourceType: NoteSourceType,
    sourceId: string,
  ): Promise<void> {
    if (sourceType === 'article') {
      const article = await this.articlesService.getArticleById(sourceId);
      if (!article) {
        throw new NotFoundException('Article not found');
      }
      return;
    }

    if (sourceType === 'transcription') {
      const transcription =
        await this.youtubeTranscriptionsService.getTranscriptionById(sourceId);
      if (!transcription) {
        throw new NotFoundException('YouTube transcription not found');
      }
      return;
    }

    throw new BadRequestException('Unsupported source_type');
  }

  private async getActiveNote(
    userId: string,
    sourceType: NoteSourceType,
    sourceId: string,
  ): Promise<Note | null> {
    return this.notesReadService.getActiveNote(userId, sourceType, sourceId);
  }

  private async insertNote(
    userId: string,
    sourceType: NoteSourceType,
    sourceId: string,
    content: string,
  ): Promise<Note> {
    const db = this.databaseService.getDbConnection();

    return new Promise((resolve, reject) => {
      db.get(
        `
          INSERT INTO notes (user_id, source_type, source_id, content)
          VALUES (?, ?, ?, ?)
          RETURNING id, user_id, source_type, source_id, content, created_at, updated_at
        `,
        [userId, sourceType, sourceId, content],
        (err: Error | null, row?: NoteRow) => {
          if (err) {
            reject(err);
            return;
          }

          if (!row) {
            reject(new Error('Note not found after creation'));
            return;
          }

          resolve(mapRowToNote(row));
        },
      );
    });
  }

  private async replaceContent(
    noteId: string,
    content: string,
  ): Promise<Note | null> {
    return this.updateActiveNote('content = ?', [content, noteId]);
  }

  private async appendContent(
    noteId: string,
    content: string,
  ): Promise<Note | null> {
    return this.updateActiveNote('content = content || ?', [
      `${NOTE_APPEND_SEPARATOR}${content}`,
      noteId,
    ]);
  }

  // Resolves null when the Note is no longer active, so the caller can retry.
  private async updateActiveNote(
    contentAssignment: 'content = ?' | 'content = content || ?',
    params: [string, string],
  ): Promise<Note | null> {
    const db = this.databaseService.getDbConnection();

    return new Promise((resolve, reject) => {
      db.get(
        `
          UPDATE notes
          SET ${contentAssignment}, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND deleted_at IS NULL
          RETURNING id, user_id, source_type, source_id, content, created_at, updated_at
        `,
        params,
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

  private async softDeleteNote(noteId: string): Promise<void> {
    const db = this.databaseService.getDbConnection();

    return new Promise((resolve, reject) => {
      db.run(
        `
          UPDATE notes
          SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND deleted_at IS NULL
        `,
        [noteId],
        (err: Error | null) => {
          if (err) {
            reject(err);
            return;
          }

          resolve();
        },
      );
    });
  }

  private isUniqueViolation(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const errorWithCode = error as Error & { code?: string };
    return (
      error.message.includes('duplicate key value') ||
      errorWithCode.code === '23505'
    );
  }
}
