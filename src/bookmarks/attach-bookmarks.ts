/** An item with the requesting user's bookmark state embedded under `is_bookmarked`. */
export type WithBookmark<T> = T & { is_bookmarked: boolean };

/**
 * Embeds `is_bookmarked` onto each item in `items`, resolved by the item's
 * article id.
 *
 * Pure and query-free: pair it with
 * `BookmarksReadService.getBookmarkedArticleIds` to shape a page of items in a
 * single database round-trip instead of a per-item lookup. Pass an empty set for
 * the api-key path, where there is no user, and every item gets `false`.
 */
export function attachBookmarks<T extends object>(
  items: readonly T[],
  getArticleId: (item: T) => string,
  bookmarkedArticleIds: ReadonlySet<string>,
): WithBookmark<T>[] {
  return items.map((item) => ({
    ...item,
    is_bookmarked: bookmarkedArticleIds.has(getArticleId(item)),
  }));
}
