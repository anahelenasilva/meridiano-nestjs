/**
 * ArticleFilter against a real Postgres database, through
 * ArticlesService.listArticles. Uses the real-connection harness from
 * articles-list-has-audio.e2e-spec.ts: the full AppModule for a live
 * DatabaseService, with seeded rows scoped by a unique marker in every title
 * so pre-existing local data never enters the result.
 */
import { DatabaseConnection, DatabaseService, SqlParams } from '@libs/database';
import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { ArticlesService } from '../src/articles/articles.service';
import { ArticleFilter } from '../src/articles/helpers/article-filter';

function runQuery(
  db: DatabaseConnection,
  sql: string,
  params: SqlParams,
): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err) => (err ? reject(err) : resolve()));
  });
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

describe('ArticleFilter (e2e, real Postgres)', () => {
  let app: INestApplication | undefined;
  let moduleFixture: TestingModule | undefined;
  let db: DatabaseConnection | undefined;
  let service: ArticlesService;

  const marker = `ArticleFilterE2E-${randomUUID()}`;
  const bodyMarker = `${marker}-body`;
  const recentTech = randomUUID();
  const oldBusiness = randomUUID();
  const archivedTech = randomUUID();

  const seeds = [
    {
      id: recentTech,
      profile: 'technology',
      source: 'Filter Source A',
      published: daysAgo(2),
      categories: '["AI"]',
      processed: 'summary',
      archivedAt: null,
    },
    {
      id: oldBusiness,
      profile: 'business',
      source: 'Filter Source B',
      published: daysAgo(60),
      categories: '["Markets"]',
      processed: `summary mentioning ${bodyMarker}`,
      archivedAt: null,
    },
    {
      id: archivedTech,
      profile: 'technology',
      source: 'Filter Source A',
      published: daysAgo(3),
      categories: '["AI"]',
      processed: 'summary',
      archivedAt: daysAgo(1),
    },
  ];

  async function listIds(
    filter: ArticleFilter,
    perPage = 20,
  ): Promise<{ ids: string[]; total: number }> {
    const { articles, total } = await service.listArticles(
      { searchTerm: marker, ...filter },
      { perPage },
    );
    return { ids: articles.map((article) => article.id).sort(), total };
  }

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    db = moduleFixture.get(DatabaseService).getDbConnection();
    service = moduleFixture.get(ArticlesService);

    for (const seed of seeds) {
      await runQuery(
        db,
        `INSERT INTO articles (id, url, title, published_date, feed_source, raw_content, processed_content, feed_profile, categories, archived_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          seed.id,
          `https://example.com/${seed.id}`,
          `${marker} ${seed.id}`,
          seed.published,
          seed.source,
          'raw content',
          seed.processed,
          seed.profile,
          seed.categories,
          seed.archivedAt,
        ],
      );
    }
  });

  afterAll(async () => {
    if (db) {
      try {
        await runQuery(db, `DELETE FROM articles WHERE id IN (?, ?, ?)`, [
          recentTech,
          oldBusiness,
          archivedTech,
        ]);
      } catch (err) {
        console.error('Failed to clean up seeded rows', err);
      }
    }

    if (app) {
      await app.close();
    }
    if (moduleFixture) {
      await moduleFixture.close();
    }
  });

  it('excludes archived articles when the filter does not opt in', async () => {
    await expect(listIds({})).resolves.toEqual({
      ids: [recentTech, oldBusiness].sort(),
      total: 2,
    });
  });

  it('returns only archived articles for the archived scope', async () => {
    await expect(listIds({ archiveScope: 'archived' })).resolves.toEqual({
      ids: [archivedTech],
      total: 1,
    });
  });

  it('returns every article for the all scope', async () => {
    const { total } = await listIds({ archiveScope: 'all' });

    expect(total).toBe(3);
  });

  it('limits rows and total to the preset window', async () => {
    await expect(listIds({ preset: 'last_30d' })).resolves.toEqual({
      ids: [recentTech],
      total: 1,
    });
  });

  it('matches the Article Source exactly', async () => {
    await expect(listIds({ feedSource: 'Filter Source B' })).resolves.toEqual({
      ids: [oldBusiness],
      total: 1,
    });
  });

  it('filters by feed profile', async () => {
    await expect(listIds({ feedProfile: 'business' })).resolves.toEqual({
      ids: [oldBusiness],
      total: 1,
    });
  });

  it('filters by category', async () => {
    await expect(listIds({ category: 'AI' })).resolves.toEqual({
      ids: [recentTech],
      total: 1,
    });
  });

  it('searches the processed content', async () => {
    const { articles, total } = await service.listArticles({
      searchTerm: bodyMarker,
    });

    expect(articles.map((article) => article.id)).toEqual([oldBusiness]);
    expect(total).toBe(1);
  });

  it('counts the whole filter, not just the page', async () => {
    const { ids, total } = await listIds({}, 1);

    expect(ids).toHaveLength(1);
    expect(total).toBe(2);
  });
});
