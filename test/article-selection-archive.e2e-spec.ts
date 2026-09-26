/**
 * The Archived Article rule on the reads that select Articles for AI output,
 * against a real Postgres database. Uses the real-connection harness from
 * article-filter.e2e-spec.ts. Results are narrowed to the seeded ids so
 * pre-existing local data never enters the assertions.
 */
import { DatabaseConnection, DatabaseService, SqlParams } from '@libs/database';
import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { ArticlesService } from '../src/articles/articles.service';
import { FeedProfile } from '../src/shared/types/feed';

function runQuery(
  db: DatabaseConnection,
  sql: string,
  params: SqlParams,
): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err) => (err ? reject(err) : resolve()));
  });
}

// Noon of yesterday in BRT (UTC-3), inside both the News Digest window and a
// 48 hour briefing lookback.
function yesterdayNoonBrt(): string {
  const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;
  const nowBrt = new Date(Date.now() - BRT_OFFSET_MS);
  const yesterdayNoonUtc = Date.UTC(
    nowBrt.getUTCFullYear(),
    nowBrt.getUTCMonth(),
    nowBrt.getUTCDate() - 1,
    12,
  );
  return new Date(yesterdayNoonUtc + BRT_OFFSET_MS).toISOString();
}

describe('Archived Articles in AI selection reads (e2e, real Postgres)', () => {
  let app: INestApplication | undefined;
  let moduleFixture: TestingModule | undefined;
  let db: DatabaseConnection | undefined;
  let service: ArticlesService;

  const anchor = randomUUID();
  const active = randomUUID();
  const archived = randomUUID();
  const seededIds: string[] = [anchor, active, archived];

  function seededOnly(articles: { id: string }[]): string[] {
    return articles
      .map((article) => article.id)
      .filter((id) => seededIds.includes(id))
      .sort();
  }

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    db = moduleFixture.get(DatabaseService).getDbConnection();
    service = moduleFixture.get(ArticlesService);

    const published = yesterdayNoonBrt();
    for (const id of seededIds) {
      await runQuery(
        db,
        `INSERT INTO articles (id, url, title, published_date, feed_source, raw_content, processed_content, embedding, impact_rating, feed_profile, archived_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          `https://example.com/${id}`,
          `ArticleSelectionArchiveE2E ${id}`,
          published,
          'Selection Source',
          'raw content',
          'summary',
          '[0.1, 0.2]',
          5,
          FeedProfile.TECHNOLOGY,
          id === archived ? new Date().toISOString() : null,
        ],
      );
    }
  });

  afterAll(async () => {
    if (db) {
      try {
        await runQuery(
          db,
          `DELETE FROM articles WHERE id IN (?, ?, ?)`,
          seededIds,
        );
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

  it('leaves archived articles out of the Standard Briefing pool', async () => {
    const pool = await service.getArticlesForBriefing(
      48,
      FeedProfile.TECHNOLOGY,
    );

    expect(seededOnly(pool)).toEqual([anchor, active].sort());
  });

  it('leaves archived articles out of related articles', async () => {
    const related = await service.getRelatedArticles(anchor, 10_000);

    expect(seededOnly(related)).toEqual([active]);
  });

  it('leaves archived articles out of News Digest selection', async () => {
    const digest = await service.getYesterdayArticlesByProfile();

    expect(seededOnly(digest)).toEqual([anchor, active].sort());
  });

  it('keeps archived articles in a Curated Briefing built from explicit ids', async () => {
    const curated = await service.getArticlesByIds(seededIds);

    expect(curated.map((article) => article.id)).toEqual(seededIds);
  });
});
