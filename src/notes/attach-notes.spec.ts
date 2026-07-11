import { attachNotes } from './attach-notes';
import { Note } from './note.entity';

describe('attachNotes', () => {
  const idA = '11111111-1111-1111-1111-111111111111';
  const idB = '22222222-2222-2222-2222-222222222222';

  const noteA: Note = {
    id: 'note-a',
    user_id: 'user-1',
    source_type: 'article',
    source_id: idA,
    content: 'Note A',
    created_at: new Date('2026-05-17T12:00:00.000Z'),
    updated_at: new Date('2026-05-17T12:05:00.000Z'),
  };

  it('embeds a NoteResponseDto-shaped note when one exists for the source_id', () => {
    const items = [{ id: idA, title: 'Article A' }];

    const result = attachNotes(items, (item) => item.id, new Map([[idA, noteA]]));

    expect(result[0]).toEqual({
      id: idA,
      title: 'Article A',
      note: {
        id: 'note-a',
        content: 'Note A',
        created_at: new Date('2026-05-17T12:00:00.000Z'),
        updated_at: new Date('2026-05-17T12:05:00.000Z'),
      },
    });
    // user_id and source_* are intentionally not exposed on the response note.
    expect(result[0].note).not.toHaveProperty('user_id');
    expect(result[0].note).not.toHaveProperty('source_id');
  });

  it('embeds note: null for items whose source_id has no active note', () => {
    const items = [{ id: idB, title: 'Article B' }];

    const result = attachNotes(items, (item) => item.id, new Map([[idA, noteA]]));

    expect(result[0].note).toBeNull();
  });

  it('preserves order and shapes each item in a mixed page independently', () => {
    const items = [
      { id: idA, title: 'Article A' },
      { id: idB, title: 'Article B' },
    ];

    const result = attachNotes(items, (item) => item.id, new Map([[idA, noteA]]));

    expect(result.map((item) => item.title)).toEqual(['Article A', 'Article B']);
    expect(result[0].note?.id).toBe('note-a');
    expect(result[1].note).toBeNull();
  });

  it('does not mutate the input items', () => {
    const item = { id: idA, title: 'Article A' };

    attachNotes([item], (i) => i.id, new Map([[idA, noteA]]));

    expect(item).not.toHaveProperty('note');
  });

  it('returns an empty list for empty input', () => {
    expect(attachNotes([], (item: { id: string }) => item.id, new Map())).toEqual(
      [],
    );
  });
});
