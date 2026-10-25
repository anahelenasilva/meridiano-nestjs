import { attachBookmarks } from './attach-bookmarks';

describe('attachBookmarks', () => {
  const idA = '11111111-1111-1111-1111-111111111111';
  const idB = '22222222-2222-2222-2222-222222222222';

  it('embeds is_bookmarked: true for items in the bookmarked set', () => {
    const items = [{ id: idA, title: 'Article A' }];

    const result = attachBookmarks(items, (item) => item.id, new Set([idA]));

    expect(result[0]).toEqual({
      id: idA,
      title: 'Article A',
      is_bookmarked: true,
    });
  });

  it('embeds is_bookmarked: false for items absent from the set', () => {
    const items = [{ id: idB, title: 'Article B' }];

    const result = attachBookmarks(items, (item) => item.id, new Set([idA]));

    expect(result[0].is_bookmarked).toBe(false);
  });

  it('preserves order and flags each item in a mixed page independently', () => {
    const items = [
      { id: idA, title: 'Article A' },
      { id: idB, title: 'Article B' },
    ];

    const result = attachBookmarks(items, (item) => item.id, new Set([idA]));

    expect(result.map((item) => item.title)).toEqual(['Article A', 'Article B']);
    expect(result.map((item) => item.is_bookmarked)).toEqual([true, false]);
  });

  it('does not mutate the input items', () => {
    const item = { id: idA, title: 'Article A' };

    attachBookmarks([item], (i) => i.id, new Set([idA]));

    expect(item).not.toHaveProperty('is_bookmarked');
  });

  it('flags every item false for an empty set, the api-key path', () => {
    const items = [{ id: idA }, { id: idB }];

    const result = attachBookmarks(items, (item) => item.id, new Set());

    expect(result.map((item) => item.is_bookmarked)).toEqual([false, false]);
  });
});
