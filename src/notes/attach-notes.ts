import { Note, NoteResponseDto } from './note.entity';

/** An item with the owner's active note (or `null`) embedded under `note`. */
export type WithNote<T> = T & { note: NoteResponseDto | null };

/**
 * Embeds `note: { id, content, created_at, updated_at }` (or `null`) onto each
 * item in `items`, resolved by the item's `source_id`.
 *
 * Pure and query-free: pair it with `NotesReadService.getActiveNotesBySourceIds`
 * to shape a page of items in a single database round-trip instead of a per-item
 * lookup. Items whose `source_id` has no active note receive `note: null`.
 */
export function attachNotes<T extends object>(
  items: readonly T[],
  getSourceId: (item: T) => string,
  notesBySourceId: ReadonlyMap<string, Note>,
): WithNote<T>[] {
  return items.map((item) => {
    const note = notesBySourceId.get(getSourceId(item));
    return { ...item, note: note ? new NoteResponseDto(note) : null };
  });
}
