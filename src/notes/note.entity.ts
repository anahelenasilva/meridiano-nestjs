import { IsDefined, IsIn, IsString, IsUUID, MaxLength } from 'class-validator';

export const NOTE_SOURCE_TYPES = ['article', 'transcription'] as const;
export type NoteSourceType = (typeof NOTE_SOURCE_TYPES)[number];

export const MAX_NOTE_CONTENT_LENGTH = 5000;

export interface Note {
  id: string;
  user_id: string;
  source_type: NoteSourceType;
  source_id: string;
  content: string;
  created_at: Date;
  updated_at: Date;
}

export class SaveNoteDto {
  @IsIn(NOTE_SOURCE_TYPES, {
    message: `source_type must be one of: ${NOTE_SOURCE_TYPES.join(', ')}`,
  })
  source_type: NoteSourceType;

  @IsUUID('4', { message: 'source_id must be a valid UUID' })
  source_id: string;

  @IsDefined({ message: 'content is required' })
  @IsString({ message: 'content must be a string' })
  @MaxLength(MAX_NOTE_CONTENT_LENGTH, {
    message: `content must not exceed ${MAX_NOTE_CONTENT_LENGTH} characters`,
  })
  content: string;
}

export class NoteResponseDto {
  id: string;
  content: string;
  created_at: Date;
  updated_at: Date;

  constructor(note: Note) {
    this.id = note.id;
    this.content = note.content;
    this.created_at = note.created_at;
    this.updated_at = note.updated_at;
  }
}

export class SaveNoteResponseDto {
  note: NoteResponseDto | null;

  constructor(note: Note | null) {
    this.note = note ? new NoteResponseDto(note) : null;
  }
}
