import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { FeedProfile } from '../shared/types/feed';
import {
  ArticleCategory,
  CountTotalArticlesInput,
  DBArticle,
  PaginatedArticleInput,
} from './article.entity';

interface ArticleRow {
  id: number;
  url: string;
  title: string;
  published_date: string;
  feed_source: string;
  raw_content: string;
  processed_content?: string | null;
  embedding?: string | null;
  impact_rating?: number | null;
  feed_profile: string;
  image_url?: string | null;
  categories?: string | null;
  created_at: string;
  content?: string;
}

interface CountRow {
  count: number;
}

@Injectable()
export class ArticlesService {
  constructor(private readonly databaseService: DatabaseService) {}

  async addArticle(
    url: string,
    title: string,
    publishedDate: Date,
    feedSource: string,
    rawContent: string,
    feedProfile: FeedProfile,
    imageUrl?: string,
    categories?: ArticleCategory[],
  ): Promise<number | null> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      const stmt = db.prepare(`
        INSERT INTO articles (url, title, published_date, feed_source, raw_content, feed_profile, image_url, categories)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        [
          url,
          title,
          publishedDate.toISOString(),
          feedSource,
          rawContent,
          feedProfile,
          imageUrl,
          categories ? JSON.stringify(categories) : null,
        ],
        function (this: { lastID?: number }, err: Error | null) {
          if (err) {
            // Handle both SQLite and PostgreSQL unique constraint errors
            const errorWithCode = err as Error & { code?: string };
            if (
              err.message.includes('UNIQUE constraint failed') ||
              err.message.includes('duplicate key value') ||
              errorWithCode.code === '23505' // PostgreSQL unique violation error code
            ) {
              resolve(null);
            } else {
              reject(err);
            }
          } else {
            resolve(this.lastID ?? null);
          }
          stmt.finalize();
        },
      );
    });
  }

  async getUnprocessedArticles(
    feedProfile: FeedProfile,
    limit: number = 1000,
  ): Promise<DBArticle[]> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      const query = `
        SELECT * FROM articles
        WHERE feed_profile = ? AND processed_content IS NULL
        ORDER BY published_date DESC
        LIMIT ?
      `;

      db.all(query, [feedProfile, limit], (err, rows: ArticleRow[]) => {
        if (err) {
          reject(err);
        } else {
          const articles: DBArticle[] = rows.map((row) => ({
            ...row,
            published_date: new Date(row.published_date),
            created_at: new Date(row.created_at),
            categories: row.categories
              ? (JSON.parse(row.categories) as ArticleCategory[])
              : undefined,
          }));
          resolve(articles);
        }
      });
    });
  }

  async updateArticleProcessing(
    articleId: number,
    processedContent: string,
    embedding: number[],
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      const stmt = db.prepare(`
        UPDATE articles
        SET processed_content = ?, embedding = ?
        WHERE id = ?
      `);

      stmt.run(
        [processedContent, JSON.stringify(embedding), articleId],
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
          stmt.finalize();
        },
      );
    });
  }

  async getUnratedArticles(
    feedProfile: FeedProfile,
    limit: number = 1000,
  ): Promise<DBArticle[]> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      const query = `
        SELECT * FROM articles
        WHERE feed_profile = ? AND processed_content IS NOT NULL AND impact_rating IS NULL
        ORDER BY published_date DESC
        LIMIT ?
      `;

      db.all(query, [feedProfile, limit], (err, rows: ArticleRow[]) => {
        if (err) {
          reject(err);
        } else {
          const articles: DBArticle[] = rows.map((row) => ({
            ...row,
            published_date: new Date(row.published_date),
            created_at: new Date(row.created_at),
            categories: row.categories
              ? (JSON.parse(row.categories) as ArticleCategory[])
              : undefined,
          }));
          resolve(articles);
        }
      });
    });
  }

  async getUncategorizedArticles(
    feedProfile: FeedProfile,
    limit: number = 1000,
  ): Promise<DBArticle[]> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      const query = `
        SELECT * FROM articles
        WHERE feed_profile = ? AND processed_content IS NOT NULL AND categories IS NULL
        ORDER BY published_date DESC
        LIMIT ?
      `;

      db.all(query, [feedProfile, limit], (err, rows: ArticleRow[]) => {
        if (err) {
          reject(err);
        } else {
          const articles: DBArticle[] = rows.map((row) => ({
            ...row,
            published_date: new Date(row.published_date),
            created_at: new Date(row.created_at),
            categories: row.categories
              ? (JSON.parse(row.categories) as ArticleCategory[])
              : undefined,
          }));
          resolve(articles);
        }
      });
    });
  }

  async updateArticleRating(
    articleId: number,
    impactRating: number,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      const stmt = db.prepare(`
        UPDATE articles
        SET impact_rating = ?
        WHERE id = ?
      `);

      stmt.run([impactRating, articleId], (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
        stmt.finalize();
      });
    });
  }

  async updateArticleCategories(
    articleId: number,
    categories: ArticleCategory[],
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      const stmt = db.prepare(`
        UPDATE articles
        SET categories = ?
        WHERE id = ?
      `);

      stmt.run([JSON.stringify(categories), articleId], (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
        stmt.finalize();
      });
    });
  }

  async getArticlesForBriefing(
    lookbackHours: number,
    feedProfile: FeedProfile,
  ): Promise<DBArticle[]> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      const cutoffTime = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);

      const query = `
        SELECT * FROM articles
        WHERE feed_profile = ?
          AND processed_content IS NOT NULL
          AND embedding IS NOT NULL
          AND published_date >= ?
        ORDER BY impact_rating DESC, published_date DESC
      `;

      db.all(
        query,
        [feedProfile, cutoffTime.toISOString()],
        (err, rows: ArticleRow[]) => {
          if (err) {
            reject(err);
          } else {
            const articles: DBArticle[] = rows.map((row) => ({
              ...row,
              published_date: new Date(row.published_date),
              created_at: new Date(row.created_at),
              categories: row.categories
                ? (JSON.parse(row.categories) as ArticleCategory[])
                : undefined,
            }));
            resolve(articles);
          }
        },
      );
    });
  }

  async deleteArticleById(articleId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();
      const stmt = db.prepare(`DELETE FROM articles WHERE id = ?`);

      stmt.run([articleId], function (err) {
        if (err) {
          console.error('Error deleting article:', err);
          reject(err);
        } else {
          resolve();
        }
        stmt.finalize();
      });
    });
  }

  async getArticleById(articleId: number): Promise<DBArticle | null> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      const query = `
        SELECT
          id, url, title, published_date, feed_source, feed_profile,
          raw_content as content, processed_content, impact_rating,
          image_url, categories, created_at
        FROM articles
        WHERE id = ?
      `;

      db.get(query, [articleId], (err, row: ArticleRow | undefined) => {
        if (err) {
          reject(err);
          return;
        }

        if (row) {
          const article: DBArticle = {
            ...row,
            published_date: new Date(row.published_date),
            created_at: new Date(row.created_at),
            categories: row.categories
              ? (JSON.parse(row.categories) as ArticleCategory[])
              : undefined,
          };
          resolve(article);
        } else {
          resolve(null);
        }
      });
    });
  }

  async getDistinctFeedProfiles(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      db.all(
        'SELECT DISTINCT feed_profile FROM articles ORDER BY feed_profile',
        [],
        (err, rows: ArticleRow[]) => {
          if (err) {
            reject(err);
            return;
          }

          resolve(rows.map((row) => row.feed_profile));
        },
      );
    });
  }

  async getDistinctCategories(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      if (!db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const query = `
        SELECT DISTINCT categories
        FROM articles
        WHERE categories IS NOT NULL AND categories != ''
      `;

      db.all(query, [], (err, rows: ArticleRow[]) => {
        if (err) {
          reject(err);
          return;
        }

        const categoriesSet = new Set<string>();

        rows.forEach((row) => {
          if (row.categories) {
            try {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              const categories = JSON.parse(row.categories);
              if (Array.isArray(categories)) {
                categories.forEach((category) => {
                  if (typeof category === 'string') {
                    categoriesSet.add(category);
                  }
                });
              }
            } catch {
              // Skip invalid JSON
            }
          }
        });

        resolve(Array.from(categoriesSet).sort());
      });
    });
  }

  async getArticlesPaginated(
    options: PaginatedArticleInput,
  ): Promise<DBArticle[]> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      const {
        page = 1,
        perPage = 20,
        sortBy = 'published_date',
        direction = 'desc',
        feedProfile,
        searchTerm,
        startDate,
        endDate,
        category,
      } = options;

      let query = `
        SELECT
          id, url, title, published_date, feed_source, feed_profile,
          raw_content as content, processed_content, impact_rating,
          image_url, categories, created_at
        FROM articles
        WHERE 1=1
      `;
      const params: (string | number)[] = [];

      if (feedProfile) {
        query += ' AND feed_profile = ?';
        params.push(feedProfile);
      }

      if (searchTerm) {
        query +=
          ' AND (title LIKE ? OR raw_content LIKE ? OR processed_content LIKE ?)';
        const searchPattern = `%${searchTerm}%`;
        params.push(searchPattern, searchPattern, searchPattern);
      }

      if (startDate) {
        query += ' AND DATE(published_date) >= ?';
        params.push(startDate);
      }

      if (endDate) {
        query += ' AND DATE(published_date) <= ?';
        params.push(endDate);
      }

      if (category) {
        query += ' AND categories LIKE ?';
        params.push(`%"${category}"%`);
      }

      const validSortColumns = [
        'published_date',
        'title',
        'impact_rating',
        'created_at',
      ];
      const sortColumn = validSortColumns.includes(sortBy)
        ? sortBy
        : 'published_date';
      const sortDirection = direction === 'asc' ? 'ASC' : 'DESC';
      query += ` ORDER BY ${sortColumn} ${sortDirection}`;

      const offset = (page - 1) * perPage;
      query += ' LIMIT ? OFFSET ?';
      params.push(perPage, offset);

      db.all(query, params, (err, rows: ArticleRow[]) => {
        if (err) {
          reject(err);
          return;
        }

        const articles: DBArticle[] = rows.map((row) => ({
          ...row,
          published_date: new Date(row.published_date),
          created_at: new Date(row.created_at),
          categories: row.categories
            ? (JSON.parse(row.categories) as ArticleCategory[])
            : undefined,
        }));

        resolve(articles);
      });
    });
  }

  async countTotalArticles(options: CountTotalArticlesInput): Promise<number> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      const { feedProfile, searchTerm, startDate, endDate, category } = options;

      let query = 'SELECT COUNT(*) as count FROM articles WHERE 1=1';
      const params: (string | number)[] = [];

      if (feedProfile) {
        query += ' AND feed_profile = ?';
        params.push(feedProfile);
      }

      if (searchTerm) {
        query +=
          ' AND (title LIKE ? OR raw_content LIKE ? OR processed_content LIKE ?)';
        const searchPattern = `%${searchTerm}%`;
        params.push(searchPattern, searchPattern, searchPattern);
      }

      if (startDate) {
        query += ' AND DATE(published_date) >= ?';
        params.push(startDate);
      }

      if (endDate) {
        query += ' AND DATE(published_date) <= ?';
        params.push(endDate);
      }

      if (category) {
        query += ' AND categories LIKE ?';
        params.push(`%"${category}"%`);
      }

      db.get(query, params, (err, row: CountRow | undefined) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(row?.count || 0);
      });
    });
  }

  async articleExists(url: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();
      db.get('SELECT id FROM articles WHERE url = ?', [url], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(!!row);
        }
      });
    });
  }

  async getRelatedArticles(
    articleId: number,
    limit: number = 5,
  ): Promise<DBArticle[]> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      const getOriginalQuery = `
        SELECT feed_profile, published_date
        FROM articles
        WHERE id = ?
      `;

      db.get(getOriginalQuery, [articleId], (err, original: ArticleRow) => {
        if (err) {
          reject(err);
          return;
        }

        if (!original) {
          resolve([]);
          return;
        }

        const relatedQuery = `
          SELECT
            id, url, title, published_date, feed_source, feed_profile,
            raw_content as content, processed_content, impact_rating,
            image_url, categories, created_at
          FROM articles
          WHERE feed_profile = ?
          AND id != ?
          ORDER BY ABS(julianday(published_date) - julianday(?)) ASC
          LIMIT ?
        `;

        if (!db) {
          reject(new Error('Database not initialized'));
          return;
        }

        db.all(
          relatedQuery,
          [original.feed_profile, articleId, original.published_date, limit],
          (err, rows: ArticleRow[]) => {
            if (err) {
              reject(err);
              return;
            }

            const articles = rows.map((row) => ({
              ...row,
              published_date: new Date(row.published_date),
              created_at: new Date(row.created_at),
              categories: row.categories
                ? (JSON.parse(row.categories) as ArticleCategory[])
                : undefined,
            }));

            resolve(articles || []);
          },
        );
      });
    });
  }
}
