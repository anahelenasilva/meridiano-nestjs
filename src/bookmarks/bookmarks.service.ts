import { DatabaseService, execute, queryAll, queryOne } from '@libs/database';
import { Injectable } from '@nestjs/common';
import {
  ArticleRow,
  articleColumns,
  mapArticleRow,
} from '../articles/article-row';
import { archiveClause } from '../articles/helpers/archive-scope';
import { AddBookmarkResult, BookmarkWithArticle } from './bookmark.entity';

interface BookmarkRow {
  id: string;
  user_id: string;
  article_id: string;
  created_at: string;
}

// Bookmark columns carry a prefix so the article columns keep their own names
// and the row can go straight through mapArticleRow.
interface BookmarkWithArticleRow extends ArticleRow {
  bookmark_id: string;
  bookmark_user_id: string;
  bookmark_created_at: string;
}

interface CountRow {
  count: number;
}

// Archived articles are hidden everywhere articles are served, bookmarks
// included. The alias matches the joined queries below.
const ACTIVE_ARTICLE = archiveClause('active', 'a.archived_at');

@Injectable()
export class BookmarksService {
  constructor(private readonly databaseService: DatabaseService) {}

  async addBookmark(
    userId: string,
    articleId: string,
  ): Promise<AddBookmarkResult> {
    const db = this.databaseService.getDbConnection();

    const wasCreated = await execute(
      db,
      `
        INSERT INTO bookmarks (user_id, article_id)
        VALUES (?, ?)
        RETURNING id, user_id, article_id, created_at
      `,
      [userId, articleId],
    ).then(
      () => true,
      (err: unknown) => {
        const errorWithCode = err as Error & { code?: string };
        const isDuplicate =
          errorWithCode.message.includes('duplicate key value') ||
          errorWithCode.code === '23505'; // PostgreSQL unique violation error code
        if (!isDuplicate) {
          throw err;
        }
        // Bookmark already exists; the read below returns the existing row.
        return false;
      },
    );

    const row = await queryOne<BookmarkRow>(
      db,
      `SELECT id, user_id, article_id, created_at FROM bookmarks WHERE user_id = ? AND article_id = ?`,
      [userId, articleId],
    );

    if (!row) {
      throw new Error(
        wasCreated
          ? 'Bookmark not found after creation'
          : 'Duplicate bookmark detected but bookmark not found',
      );
    }

    return {
      bookmark: {
        id: row.id,
        user_id: row.user_id,
        article_id: row.article_id,
        created_at: new Date(row.created_at),
      },
      wasCreated,
    };
  }

  async removeBookmark(userId: string, articleId: string): Promise<boolean> {
    const db = this.databaseService.getDbConnection();
    const changes = await execute(
      db,
      `
        DELETE FROM bookmarks
        WHERE user_id = ? AND article_id = ?
      `,
      [userId, articleId],
    );
    return changes > 0;
  }

  async getBookmarks(
    userId: string,
    page: number = 1,
    perPage: number = 20,
  ): Promise<{
    bookmarks: BookmarkWithArticle[];
    total: number;
    page: number;
    perPage: number;
  }> {
    const offset = (page - 1) * perPage;
    const db = this.databaseService.getDbConnection();

    const countRow = await queryOne<CountRow>(
      db,
      `SELECT COUNT(*) as count
         FROM bookmarks b
         INNER JOIN articles a ON b.article_id = a.id
         WHERE b.user_id = ? AND ${ACTIVE_ARTICLE}`,
      [userId],
    );
    const total = countRow?.count || 0;

    const rows = await queryAll<BookmarkWithArticleRow>(
      db,
      `
          SELECT
            b.id AS bookmark_id,
            b.user_id AS bookmark_user_id,
            b.created_at AS bookmark_created_at,
            ${articleColumns('a')}
          FROM bookmarks b
          INNER JOIN articles a ON b.article_id = a.id
          WHERE b.user_id = ? AND ${ACTIVE_ARTICLE}
          ORDER BY b.created_at DESC
          LIMIT ? OFFSET ?
        `,
      [userId, perPage, offset],
    );

    const bookmarks: BookmarkWithArticle[] = rows.map(
      ({
        bookmark_id,
        bookmark_user_id,
        bookmark_created_at,
        ...articleRow
      }) => ({
        id: bookmark_id,
        user_id: bookmark_user_id,
        article_id: articleRow.id,
        created_at: new Date(bookmark_created_at),
        article: mapArticleRow(articleRow),
      }),
    );

    return { bookmarks, total, page, perPage };
  }

  async isBookmarked(userId: string, articleId: string): Promise<boolean> {
    const db = this.databaseService.getDbConnection();
    const row = await queryOne(
      db,
      `SELECT 1 FROM bookmarks WHERE user_id = ? AND article_id = ? LIMIT 1`,
      [userId, articleId],
    );
    return !!row;
  }

  async getBookmarkCount(userId: string): Promise<number> {
    const db = this.databaseService.getDbConnection();
    const row = await queryOne<CountRow>(
      db,
      `SELECT COUNT(*) as count
         FROM bookmarks b
         INNER JOIN articles a ON b.article_id = a.id
         WHERE b.user_id = ? AND ${ACTIVE_ARTICLE}`,
      [userId],
    );
    return row?.count || 0;
  }
}
