import {
  DatabaseService,
  execute,
  queryAll,
  queryOne,
  SqlParams,
} from '@libs/database';
import { Injectable } from '@nestjs/common';
import { AudioFilesCleanupService } from '../audio-files/audio-files-cleanup.service';
import { NotesCleanupService } from '../notes/notes-cleanup.service';
import { FeedProfile } from '../shared/types/feed';
import {
  ArticleCategory,
  CountTotalArticlesInput,
  DBArticle,
  PaginatedArticleInput,
  UpdateArticlePatch,
} from './article.entity';
import { archiveClause, ArchiveScope } from './helpers/archive-scope';

interface ArticleRow {
  id: string;
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
  custom_prompt?: string | null;
  created_at: string;
  archived_at?: string | null;
}

interface CountRow {
  count: number;
}

// Row shape for getArticlesPaginated only: has_audio comes from an EXISTS
// subquery, not a real articles column, so it stays out of the shared
// ArticleRow used by every other query in this service.
type ArticleListDbRow = ArticleRow & { has_audio: boolean };

// Per-query read model: has_audio is derived (EXISTS against audio_files),
// not a schema column, so it lives here rather than on DBArticle.
export type ArticleListRow = DBArticle & { has_audio: boolean };

// Every explicit-column read or RETURNING clause in this service selects the
// same fourteen columns. One constant keeps a new column from requiring an
// edit at each call site; missing one is a silent null field, not a compiler
// error or a failing test.
const ARTICLE_COLUMNS =
  'id, url, title, published_date, feed_source, feed_profile, raw_content, processed_content, impact_rating, image_url, categories, custom_prompt, created_at, archived_at';

// Every read in this service returned an identical hand-written row mapping.
// One mapper keeps a new column from having to be added in fourteen places.
function mapArticleRow(row: ArticleRow): DBArticle {
  return {
    ...row,
    published_date: new Date(row.published_date),
    created_at: new Date(row.created_at),
    categories: row.categories
      ? (JSON.parse(row.categories) as ArticleCategory[])
      : undefined,
    archived_at: row.archived_at ? new Date(row.archived_at) : null,
  };
}

@Injectable()
export class ArticlesService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly notesCleanupService: NotesCleanupService,
    private readonly audioFilesCleanupService: AudioFilesCleanupService,
  ) {}

  async addArticle(
    url: string,
    title: string,
    publishedDate: Date,
    feedSource: string,
    rawContent: string,
    feedProfile: FeedProfile,
    imageUrl?: string,
    categories?: ArticleCategory[],
    customPrompt?: string,
  ): Promise<string | null> {
    const db = this.databaseService.getDbConnection();

    try {
      const row = await queryOne<{ id: string }>(
        db,
        `
        INSERT INTO articles (url, title, published_date, feed_source, raw_content, feed_profile, image_url, categories, custom_prompt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING id
      `,
        [
          url,
          title,
          publishedDate.toISOString(),
          feedSource,
          rawContent,
          feedProfile,
          imageUrl,
          categories ? JSON.stringify(categories) : null,
          customPrompt || null,
        ],
      );
      return row?.id ?? null;
    } catch (err) {
      const errorWithCode = err as Error & { code?: string };
      if (
        errorWithCode.message.includes('duplicate key value') ||
        errorWithCode.code === '23505' // PostgreSQL unique violation error code
      ) {
        return null;
      }
      throw err;
    }
  }

  async getUnprocessedArticles(
    feedProfile: FeedProfile,
    limit: number = 1000,
  ): Promise<DBArticle[]> {
    const db = this.databaseService.getDbConnection();

    const query = `
        SELECT * FROM articles
        WHERE feed_profile = ? AND processed_content IS NULL
        ORDER BY published_date DESC
        LIMIT ?
      `;

    const rows = await queryAll<ArticleRow>(db, query, [feedProfile, limit]);
    return rows.map(mapArticleRow);
  }

  async updateArticleProcessing(
    articleId: string,
    processedContent: string,
    embedding?: number[] | null,
  ): Promise<void> {
    const db = this.databaseService.getDbConnection();
    await execute(
      db,
      `
        UPDATE articles
        SET processed_content = ?, embedding = ?
        WHERE id = ?
      `,
      [processedContent, embedding ? JSON.stringify(embedding) : null, articleId],
    );
  }

  // Newest first so a partial run still fixes the current briefing window.
  async getArticlesToReembed(): Promise<
    Array<{ id: string; processed_content: string }>
  > {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      const query = `
        SELECT id, processed_content FROM articles
        WHERE processed_content IS NOT NULL
        ORDER BY published_date DESC
      `;

      db.all(
        query,
        [],
        (err, rows: Array<{ id: string; processed_content: string }>) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        },
      );
    });
  }

  async updateArticleEmbedding(
    articleId: string,
    embedding: number[],
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      const stmt = db.prepare(`
        UPDATE articles
        SET embedding = ?
        WHERE id = ?
      `);

      stmt.run([JSON.stringify(embedding), articleId], (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
        stmt.finalize();
      });
    });
  }

  async getUnratedArticles(
    feedProfile: FeedProfile,
    limit: number = 1000,
  ): Promise<DBArticle[]> {
    const db = this.databaseService.getDbConnection();

    const query = `
        SELECT * FROM articles
        WHERE feed_profile = ? AND processed_content IS NOT NULL AND impact_rating IS NULL
        ORDER BY published_date DESC
        LIMIT ?
      `;

    const rows = await queryAll<ArticleRow>(db, query, [feedProfile, limit]);
    return rows.map(mapArticleRow);
  }

  async getUncategorizedArticles(
    feedProfile: FeedProfile,
    limit: number = 1000,
  ): Promise<DBArticle[]> {
    const db = this.databaseService.getDbConnection();

    const query = `
        SELECT * FROM articles
        WHERE feed_profile = ? AND processed_content IS NOT NULL AND categories IS NULL
        ORDER BY published_date DESC
        LIMIT ?
      `;

    const rows = await queryAll<ArticleRow>(db, query, [feedProfile, limit]);
    return rows.map(mapArticleRow);
  }

  async updateArticleRating(
    articleId: string,
    impactRating: number,
  ): Promise<void> {
    const db = this.databaseService.getDbConnection();
    await execute(
      db,
      `
        UPDATE articles
        SET impact_rating = ?
        WHERE id = ?
      `,
      [impactRating, articleId],
    );
  }

  async updateArticleCategories(
    articleId: string,
    categories: ArticleCategory[],
  ): Promise<void> {
    const db = this.databaseService.getDbConnection();
    await execute(
      db,
      `
        UPDATE articles
        SET categories = ?
        WHERE id = ?
      `,
      [JSON.stringify(categories), articleId],
    );
  }

  /**
   * Partial in-place metadata correction. Builds a dynamic SET clause over only
   * the keys present in `patch`, so an omitted field is never written. Returns
   * the updated row via `RETURNING`, or null when no article matches `id`.
   *
   * `categories` is stored JSON-stringified (matching the column format) and is
   * de-duplicated here; `[]` persists as the string "[]" (non-null), which keeps
   * a manual category edit from being re-picked by the auto-categorisation job
   * (it selects only rows where `categories IS NULL`).
   */
  async updateArticle(
    articleId: string,
    patch: UpdateArticlePatch,
  ): Promise<DBArticle | null> {
    const setClauses: string[] = [];
    const params: SqlParams = [];

    if (patch.title !== undefined) {
      setClauses.push('title = ?');
      params.push(patch.title);
    }
    if (patch.publishedDate !== undefined) {
      setClauses.push('published_date = ?');
      params.push(patch.publishedDate.toISOString());
    }
    if (patch.feedSource !== undefined) {
      setClauses.push('feed_source = ?');
      params.push(patch.feedSource);
    }
    if (patch.feedProfile !== undefined) {
      setClauses.push('feed_profile = ?');
      params.push(patch.feedProfile);
    }
    if (patch.categories !== undefined) {
      const deduped = [...new Set(patch.categories)];
      setClauses.push('categories = ?');
      params.push(JSON.stringify(deduped));
    }

    if (setClauses.length === 0) {
      return this.getArticleById(articleId);
    }

    params.push(articleId);

    const db = this.databaseService.getDbConnection();

    const query = `
        UPDATE articles
        SET ${setClauses.join(', ')}
        WHERE id = ?
        RETURNING
          ${ARTICLE_COLUMNS}
      `;

    const row = await queryOne<ArticleRow>(db, query, params);
    return row ? mapArticleRow(row) : null;
  }

  /**
   * Idempotent: COALESCE keeps the first archive timestamp, so a repeated POST
   * does not re-stamp the article and reorder it in the Archive view.
   * Resolves null when no row matched, which the controller turns into a 404.
   */
  async archiveArticle(articleId: string): Promise<DBArticle | null> {
    return this.setArchivedAt(
      articleId,
      'COALESCE(archived_at, CURRENT_TIMESTAMP)',
    );
  }

  async unarchiveArticle(articleId: string): Promise<DBArticle | null> {
    return this.setArchivedAt(articleId, 'NULL');
  }

  private async setArchivedAt(
    articleId: string,
    // The literal union keeps this raw-SQL-interpolation surface closed to
    // user input at compile time, not just by convention.
    valueExpression: 'COALESCE(archived_at, CURRENT_TIMESTAMP)' | 'NULL',
  ): Promise<DBArticle | null> {
    const db = this.databaseService.getDbConnection();

    const query = `
        UPDATE articles
        SET archived_at = ${valueExpression}
        WHERE id = ?
        RETURNING
          ${ARTICLE_COLUMNS}
      `;

    const row = await queryOne<ArticleRow>(db, query, [articleId]);
    return row ? mapArticleRow(row) : null;
  }

  async getArticlesByIds(ids: string[]): Promise<DBArticle[]> {
    if (!ids || ids.length === 0) {
      return [];
    }

    const db = this.databaseService.getDbConnection();
    const rows = await queryAll<ArticleRow>(
      db,
      `
        SELECT
          ${ARTICLE_COLUMNS}
        FROM articles
        WHERE id = ANY(?::uuid[])
        ORDER BY array_position(?::uuid[], id)
      `,
      [ids, ids],
    );
    return rows.map(mapArticleRow);
  }

  async getArticlesForBriefing(
    lookbackHours: number,
    feedProfile: FeedProfile,
  ): Promise<DBArticle[]> {
    const db = this.databaseService.getDbConnection();

    const millisecondsPerHour = 60 * 60 * 1000;
    const hoursInMilliseconds = lookbackHours * millisecondsPerHour;
    const cutoffTime = new Date(Date.now() - hoursInMilliseconds);

    const query = `
        SELECT * FROM articles
        WHERE feed_profile = ?
          AND processed_content IS NOT NULL
          AND embedding IS NOT NULL
          AND published_date >= ?
          AND archived_at IS NULL
        ORDER BY impact_rating DESC, published_date DESC
      `;

    const rows = await queryAll<ArticleRow>(db, query, [
      feedProfile,
      cutoffTime.toISOString(),
    ]);
    return rows.map(mapArticleRow);
  }

  async deleteArticleById(articleId: string): Promise<void> {
    const db = this.databaseService.getDbConnection();

    await execute(db, `DELETE FROM articles WHERE id = ?`, [articleId]).catch(
      (err: unknown) => {
        console.error('Error deleting article:', err);
        throw err;
      },
    );

    await this.notesCleanupService.purgeNotesForSource('article', articleId);
    await this.audioFilesCleanupService.purgeAudioForSource(
      'article',
      articleId,
    );
  }

  async getArticleById(articleId: string): Promise<DBArticle | null> {
    const db = this.databaseService.getDbConnection();

    const query = `
        SELECT
          ${ARTICLE_COLUMNS}
        FROM articles
        WHERE id = ?
      `;

    const row = await queryOne<ArticleRow>(db, query, [articleId]);
    return row ? mapArticleRow(row) : null;
  }

  async getDistinctFeedProfiles(): Promise<string[]> {
    const db = this.databaseService.getDbConnection();
    const rows = await queryAll<Pick<ArticleRow, 'feed_profile'>>(
      db,
      'SELECT DISTINCT feed_profile FROM articles ORDER BY feed_profile',
      [],
    );
    return rows.map((row) => row.feed_profile);
  }

  async getDistinctCategories(
    archiveScope: ArchiveScope = 'active',
  ): Promise<string[]> {
    const db = this.databaseService.getDbConnection();

    let query = `
        SELECT DISTINCT categories
        FROM articles
        WHERE categories IS NOT NULL
          AND categories != ''
      `;

    const scopeClause = archiveClause(archiveScope);
    if (scopeClause) {
      query += ` AND ${scopeClause}`;
    }

    const rows = await queryAll<Pick<ArticleRow, 'categories'>>(db, query, []);

    const categoriesSet = new Set<string>();

    rows.forEach((row) => {
      if (row.categories) {
        try {
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

    return Array.from(categoriesSet).sort();
  }

  async getDistinctFeedSources(
    archiveScope: ArchiveScope = 'active',
  ): Promise<string[]> {
    const db = this.databaseService.getDbConnection();

    let query = `
        SELECT DISTINCT feed_source
        FROM articles
        WHERE feed_source IS NOT NULL
          AND feed_source != ''
      `;

    const scopeClause = archiveClause(archiveScope);
    if (scopeClause) {
      query += ` AND ${scopeClause}`;
    }

    query += ' ORDER BY feed_source';

    const rows = await queryAll<Pick<ArticleRow, 'feed_source'>>(
      db,
      query,
      [],
    );
    return rows.map((row) => row.feed_source);
  }

  async getArticlesPaginated(
    options: PaginatedArticleInput,
  ): Promise<ArticleListRow[]> {
    const db = this.databaseService.getDbConnection();

    const {
      page = 1,
      perPage = 20,
      sortBy = 'published_date',
      direction = 'desc',
      feedProfile,
      feedSource,
      searchTerm,
      startDate,
      endDate,
      category,
      archiveScope = 'active',
    } = options;

    let query = `
        SELECT
          ${ARTICLE_COLUMNS},
          EXISTS (
            SELECT 1 FROM audio_files af
            WHERE af.source_type = 'article' AND af.source_id = articles.id
          ) AS has_audio
        FROM articles
        WHERE 1=1
      `;
    const params: (string | number)[] = [];

    // Defaulting to active here rather than at each call site: a read path
    // added later inherits the exclusion instead of silently leaking
    // archived articles into a briefing.
    const scopeClause = archiveClause(archiveScope);
    if (scopeClause) {
      query += ` AND ${scopeClause}`;
    }

    if (feedProfile) {
      query += ' AND feed_profile = ?';
      params.push(feedProfile);
    }

    if (feedSource) {
      query += ' AND feed_source = ?';
      params.push(feedSource);
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

    const rows = await queryAll<ArticleListDbRow>(db, query, params);

    // Postgres returns EXISTS as a real boolean (see youtube_channels.enabled
    // for the same driver behavior on a plain boolean column), so no coercion.
    return rows.map((row) => ({
      ...mapArticleRow(row),
      has_audio: row.has_audio,
    }));
  }

  async countTotalArticles(options: CountTotalArticlesInput): Promise<number> {
    const db = this.databaseService.getDbConnection();

    const {
      feedProfile,
      feedSource,
      searchTerm,
      startDate,
      endDate,
      category,
      archiveScope = 'active',
    } = options;

    let query = 'SELECT COUNT(*) as count FROM articles WHERE 1=1';
    const params: (string | number)[] = [];

    const scopeClause = archiveClause(archiveScope);
    if (scopeClause) {
      query += ` AND ${scopeClause}`;
    }

    if (feedProfile) {
      query += ' AND feed_profile = ?';
      params.push(feedProfile);
    }

    if (feedSource) {
      query += ' AND feed_source = ?';
      params.push(feedSource);
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

    const row = await queryOne<CountRow>(db, query, params);
    return row?.count || 0;
  }

  async articleExists(url: string): Promise<boolean> {
    const db = this.databaseService.getDbConnection();
    const row = await queryOne<{ id: string }>(
      db,
      'SELECT id FROM articles WHERE url = ?',
      [url],
    );
    return !!row;
  }

  async getArticleByUrl(url: string): Promise<DBArticle | null> {
    const db = this.databaseService.getDbConnection();

    const query = `
        SELECT
          ${ARTICLE_COLUMNS}
        FROM articles
        WHERE url = ?
      `;

    const row = await queryOne<ArticleRow>(db, query, [url]);
    return row ? mapArticleRow(row) : null;
  }

  async getRelatedArticles(
    articleId: string,
    limit: number = 5,
  ): Promise<DBArticle[]> {
    const db = this.databaseService.getDbConnection();

    const original = await queryOne<
      Pick<ArticleRow, 'feed_profile' | 'published_date'>
    >(
      db,
      `
        SELECT feed_profile, published_date
        FROM articles
        WHERE id = ?
      `,
      [articleId],
    );

    if (!original) {
      return [];
    }

    const rows = await queryAll<ArticleRow>(
      db,
      `
          SELECT
            ${ARTICLE_COLUMNS}
          FROM articles
          WHERE feed_profile = ?
          AND id != ?
          AND archived_at IS NULL
          ORDER BY ABS(EXTRACT(epoch FROM (published_date - ?::timestamp))) ASC
          LIMIT ?
        `,
      [original.feed_profile, articleId, original.published_date, limit],
    );
    return rows.map(mapArticleRow);
  }

  async getUnprocessedArticleById(
    articleId: string,
  ): Promise<DBArticle | null> {
    const db = this.databaseService.getDbConnection();

    const query = `
        SELECT * FROM articles
        WHERE id = ? AND processed_content IS NULL
      `;

    const row = await queryOne<ArticleRow>(db, query, [articleId]);
    return row ? mapArticleRow(row) : null;
  }

  async getUnratedArticleById(articleId: string): Promise<DBArticle | null> {
    const db = this.databaseService.getDbConnection();

    const query = `
        SELECT * FROM articles
        WHERE id = ? AND processed_content IS NOT NULL AND impact_rating IS NULL
      `;

    const row = await queryOne<ArticleRow>(db, query, [articleId]);
    return row ? mapArticleRow(row) : null;
  }

  async getYesterdayArticlesByProfile(): Promise<DBArticle[]> {
    const db = this.databaseService.getDbConnection();

    const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;
    const now = new Date();
    const nowBrt = new Date(now.getTime() - BRT_OFFSET_MS);
    const todayMidnightBrt = new Date(
      Date.UTC(
        nowBrt.getUTCFullYear(),
        nowBrt.getUTCMonth(),
        nowBrt.getUTCDate(),
      ),
    );
    const startOfTodayBrt = new Date(
      todayMidnightBrt.getTime() + BRT_OFFSET_MS,
    );
    const startOfYesterdayBrt = new Date(
      startOfTodayBrt.getTime() - 24 * 60 * 60 * 1000,
    );

    const query = `
        SELECT * FROM articles
        WHERE feed_profile = ?
          AND impact_rating IS NOT NULL
          AND published_date >= ?
          AND published_date < ?
          AND archived_at IS NULL
        ORDER BY impact_rating DESC
      `;

    const rows = await queryAll<ArticleRow>(db, query, [
      FeedProfile.TECHNOLOGY,
      startOfYesterdayBrt.toISOString(),
      startOfTodayBrt.toISOString(),
    ]);
    return rows.map(mapArticleRow);
  }

  async getUncategorizedArticleById(
    articleId: string,
  ): Promise<DBArticle | null> {
    const db = this.databaseService.getDbConnection();

    const query = `
        SELECT * FROM articles
        WHERE id = ? AND processed_content IS NOT NULL AND categories IS NULL
      `;

    const row = await queryOne<ArticleRow>(db, query, [articleId]);
    return row ? mapArticleRow(row) : null;
  }
}
