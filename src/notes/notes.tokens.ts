import type { Note, SaveNoteDto } from './note.entity';

export const NOTES_SERVICE = Symbol('NOTES_SERVICE');

export interface NotesWriter {
  saveNote(userId: string, input: SaveNoteDto): Promise<Note | null>;
}
