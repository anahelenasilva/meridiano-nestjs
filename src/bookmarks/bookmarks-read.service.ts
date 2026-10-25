import { DatabaseService, queryAll, queryOne } from '@libs/database';
import { Injectable } from '@nestjs/common';

interface BookmarkedArticleIdRow {
  article_id: string;
}

/**
 * Read-only access to bookmark state.
 *
 * Lives in its own module (`BookmarksReadModule`) with no dependency on
 * `ArticlesModule`, so the article list query can embed `is_bookmarked` without
 * importing `BookmarksModule` and forming `ArticlesModule -> BookmarksModule ->
 * ArticlesModule`. Same reasoning as `NotesReadService` per ADR-0005.
 */
@Injectable()
export class BookmarksReadService {
  constructor(private readonly databaseService: DatabaseService) {}

  async isBookmarked(userId: string, articleId: string): Promise<boolean> {
    const db = this.databaseService.getDbConnection();
    const row = await queryOne(
      db,
      `SELECT 1 FROM bookmarks WHERE user_id = ? AND article_id = ? LIMIT 1`,
      [userId, articleId],
    );
    return !!row;
  }

  /**
   * Returns the subset of `articleIds` that `userId` has bookmarked.
   *
   * Runs a single query regardless of how many ids are requested, so callers can
   * embed bookmark state onto a page of articles without an N+1 lookup pattern.
   * An empty `articleIds` short-circuits to an empty set without touching the
   * database.
   *
   * Deliberately unfiltered by archive state: archiving and bookmarking are
   * orthogonal, so an archived article still reports its real bookmark state.
   */
  async getBookmarkedArticleIds(
    userId: string,
    articleIds: readonly string[],
  ): Promise<Set<string>> {
    if (articleIds.length === 0) {
      return new Set();
    }

    // De-duplicate so a page with repeated ids still binds a clean id array.
    const uniqueArticleIds = [...new Set(articleIds)];
    const db = this.databaseService.getDbConnection();

    const rows = await queryAll<BookmarkedArticleIdRow>(
      db,
      `
        SELECT article_id
        FROM bookmarks
        WHERE user_id = ? AND article_id = ANY(?::uuid[])
      `,
      [userId, uniqueArticleIds],
    );

    return new Set(rows.map((row) => row.article_id));
  }
}
