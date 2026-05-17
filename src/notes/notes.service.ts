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
  Note,
  NoteSourceType,
  SaveNoteDto,
} from './note.entity';

interface NoteRow {
  id: string;
  user_id: string;
  source_type: NoteSourceType;
  source_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class NotesService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly articlesService: ArticlesService,
    private readonly youtubeTranscriptionsService: YoutubeTranscriptionsService,
  ) {}

  async saveNote(userId: string, input: SaveNoteDto): Promise<Note | null> {
    await this.assertSourceExists(input.source_type, input.source_id);

    const isBlankContent = input.content.trim().length === 0;

    for (let attempt = 0; attempt < 2; attempt++) {
      const activeNote = await this.getActiveNote(
        userId,
        input.source_type,
        input.source_id,
      );

      if (isBlankContent) {
        if (!activeNote) {
          return null;
        }

        await this.softDeleteNote(activeNote.id);
        return null;
      }

      if (activeNote) {
        return this.updateActiveNote(activeNote.id, input.content);
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

          resolve(row ? this.mapRowToNote(row) : null);
        },
      );
    });
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

          resolve(this.mapRowToNote(row));
        },
      );
    });
  }

  private async updateActiveNote(noteId: string, content: string): Promise<Note> {
    const db = this.databaseService.getDbConnection();

    return new Promise((resolve, reject) => {
      db.get(
        `
          UPDATE notes
          SET content = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND deleted_at IS NULL
          RETURNING id, user_id, source_type, source_id, content, created_at, updated_at
        `,
        [content, noteId],
        (err: Error | null, row?: NoteRow) => {
          if (err) {
            reject(err);
            return;
          }

          if (!row) {
            reject(new Error('Active note not found during update'));
            return;
          }

          resolve(this.mapRowToNote(row));
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

  private mapRowToNote(row: NoteRow): Note {
    return {
      id: row.id,
      user_id: row.user_id,
      source_type: row.source_type,
      source_id: row.source_id,
      content: row.content,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    };
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
