import { Injectable } from '@nestjs/common';
import { ArticleCategory, DBArticle } from '../articles/article.entity';
import { DatabaseService } from '../database/database.service';
import { Bookmark, BookmarkWithArticle } from './bookmark.entity';

interface BookmarkRow {
  id: string;
  user_id: string;
  article_id: string;
  created_at: string;
}

interface BookmarkWithArticleRow extends BookmarkRow {
  article_url: string;
  article_title: string;
  article_published_date: string;
  article_feed_source: string;
  article_raw_content: string;
  article_processed_content?: string | null;
  article_embedding?: string | null;
  article_impact_rating?: number | null;
  article_feed_profile: string;
  article_image_url?: string | null;
  article_created_at: string;
  article_categories?: string | null;
}

interface CountRow {
  count: number;
}

@Injectable()
export class BookmarksService {
  constructor(private readonly databaseService: DatabaseService) { }

  async addBookmark(userId: string, articleId: string): Promise<Bookmark | null> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      db.run(
        `
        INSERT INTO bookmarks (user_id, article_id)
        VALUES (?, ?)
        RETURNING id, user_id, article_id, created_at
      `,
        [userId, articleId],
        (err: Error | null) => {
          if (err) {
            const errorWithCode = err as Error & { code?: string };
            if (
              err.message.includes('duplicate key value') ||
              errorWithCode.code === '23505' // PostgreSQL unique violation error code
            ) {
              // Bookmark already exists
              resolve(null);
            } else {
              reject(err);
            }
          } else {
            // Get the newly created bookmark
            db.get(
              `SELECT id, user_id, article_id, created_at FROM bookmarks WHERE user_id = ? AND article_id = ?`,
              [userId, articleId],
              (getErr: Error | null, row?: BookmarkRow) => {
                if (getErr) {
                  reject(getErr);
                } else if (!row) {
                  reject(new Error('Bookmark not found after creation'));
                } else {
                  resolve({
                    id: row.id,
                    user_id: row.user_id,
                    article_id: row.article_id,
                    created_at: new Date(row.created_at),
                  });
                }
              },
            );
          }
        },
      );
    });
  }

  async removeBookmark(userId: string, articleId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      db.run(
        `
        DELETE FROM bookmarks
        WHERE user_id = ? AND article_id = ?
      `,
        [userId, articleId],
        function (this: { changes?: number }, err: Error | null) {
          if (err) {
            reject(err);
          } else {
            resolve((this.changes ?? 0) > 0);
          }
        },
      );
    });
  }

  async getBookmarks(
    userId: string,
    page: number = 1,
    perPage: number = 20,
  ): Promise<{ bookmarks: BookmarkWithArticle[]; total: number; page: number; perPage: number }> {
    const offset = (page - 1) * perPage;

    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      // Get total count
      db.get(
        `SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ?`,
        [userId],
        (countErr: Error | null, countRow?: CountRow) => {
          if (countErr) {
            reject(countErr);
            return;
          }

          const total = countRow?.count || 0;

          db.all(
            `
          SELECT
            b.id,
            b.user_id,
            b.article_id,
            b.created_at,
            a.url as article_url,
            a.title as article_title,
            a.published_date as article_published_date,
            a.feed_source as article_feed_source,
            a.raw_content as article_raw_content,
            a.processed_content as article_processed_content,
            a.embedding as article_embedding,
            a.impact_rating as article_impact_rating,
            a.feed_profile as article_feed_profile,
            a.image_url as article_image_url,
            a.created_at as article_created_at,
            a.categories as article_categories
          FROM bookmarks b
          INNER JOIN articles a ON b.article_id = a.id
          WHERE b.user_id = ?
          ORDER BY b.created_at DESC
          LIMIT ? OFFSET ?
        `,
            [userId, perPage, offset],
            (err: Error | null, rows?: BookmarkWithArticleRow[]) => {
              if (err) {
                reject(err);
              } else {
                const bookmarks: BookmarkWithArticle[] = (rows || []).map((row) => {
                  const article: DBArticle = {
                    id: row.article_id,
                    url: row.article_url,
                    title: row.article_title,
                    published_date: new Date(row.article_published_date),
                    feed_source: row.article_feed_source,
                    raw_content: row.article_raw_content,
                    processed_content: row.article_processed_content,
                    embedding: row.article_embedding,
                    impact_rating: row.article_impact_rating,
                    feed_profile: row.article_feed_profile,
                    image_url: row.article_image_url,
                    created_at: new Date(row.article_created_at),
                    categories: row.article_categories
                      ? (JSON.parse(row.article_categories) as ArticleCategory[])
                      : null,
                  };

                  return {
                    id: row.id,
                    user_id: row.user_id,
                    article_id: row.article_id,
                    created_at: new Date(row.created_at),
                    article,
                  };
                });

                resolve({
                  bookmarks,
                  total,
                  page,
                  perPage,
                });
              }
            },
          );
        },
      );
    });
  }

  async isBookmarked(userId: string, articleId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      db.get(
        `SELECT 1 FROM bookmarks WHERE user_id = ? AND article_id = ? LIMIT 1`,
        [userId, articleId],
        (err: Error | null, row?: any) => {
          if (err) {
            reject(err);
          } else {
            resolve(!!row);
          }
        },
      );
    });
  }

  async getBookmarkCount(userId: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      db.get(
        `SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ?`,
        [userId],
        (err: Error | null, row?: CountRow) => {
          if (err) {
            reject(err);
          } else {
            resolve(row?.count || 0);
          }
        },
      );
    });
  }
}
