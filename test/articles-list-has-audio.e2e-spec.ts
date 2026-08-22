/**
 * Seeded e2e for GET /api/articles against a real Postgres database, proving
 * the has_audio EXISTS subquery added to ArticlesService.getArticlesPaginated
 * round-trips correctly. Everything else about the route (pagination math,
 * notes attachment, response shape) already has coverage elsewhere; this spec
 * only needs to prove the audio_files correlation behaves.
 *
 * Bootstraps the full AppModule like audio-library.e2e-spec.ts, since that is
 * the only way to reach a real DatabaseService/DB connection and the real
 * JwtAuthGuard. A user and JWT are minted the same way: JWT_SECRET is set on
 * process.env before the module compiles, then JwtService.sign({ sub, email }).
 *
 * Unlike audio-library.e2e-spec.ts, this route filters has_audio per article
 * via a correlated subquery rather than reading the whole audio_files table,
 * so there is no need to snapshot/wipe/restore that table: the seeded audio_files
 * row is inserted and deleted directly. The two seeded articles are isolated
 * from any pre-existing local data with a unique searchTerm marker embedded in
 * both titles.
 */
import { DatabaseConnection, DatabaseService } from '@libs/database';
import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

function runQuery(
  db: DatabaseConnection,
  sql: string,
  params: unknown[],
): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err) => (err ? reject(err) : resolve()));
  });
}

describe('GET /api/articles has_audio (e2e)', () => {
  let app: INestApplication<App> | undefined;
  let moduleFixture: TestingModule | undefined;
  let db: DatabaseConnection | undefined;
  let originalJwtSecret: string | undefined;
  let token: string;

  const userId = randomUUID();
  const articleWithAudioId = randomUUID();
  const articleWithoutAudioId = randomUUID();
  // Embedded in both seeded titles and used as the searchTerm, so the list
  // response is scoped to only these two articles regardless of what else
  // already exists in the local database.
  const marker = `HasAudioBadgeE2E-${randomUUID()}`;

  beforeAll(async () => {
    originalJwtSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-e2e-tests';

    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    db = moduleFixture.get(DatabaseService).getDbConnection();

    await runQuery(
      db,
      `INSERT INTO users (id, email, username, password, is_email_verified)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, `articles-has-audio-e2e-${userId}@example.com`, `articles-has-audio-e2e-${userId}`, 'unused', true],
    );

    const jwtService = moduleFixture.get(JwtService);
    token = jwtService.sign({
      sub: userId,
      email: `articles-has-audio-e2e-${userId}@example.com`,
    });

    await runQuery(
      db,
      `INSERT INTO articles (id, url, title, published_date, feed_source, raw_content, feed_profile)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        articleWithAudioId,
        `https://example.com/${articleWithAudioId}`,
        `${marker} - with audio`,
        '2026-01-01T00:00:00.000Z',
        'Seeded Feed Source',
        'raw content',
        'technology',
      ],
    );
    await runQuery(
      db,
      `INSERT INTO articles (id, url, title, published_date, feed_source, raw_content, feed_profile)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        articleWithoutAudioId,
        `https://example.com/${articleWithoutAudioId}`,
        `${marker} - without audio`,
        '2026-01-02T00:00:00.000Z',
        'Seeded Feed Source',
        'raw content',
        'technology',
      ],
    );

    await runQuery(
      db,
      `INSERT INTO audio_files (source_type, source_id, s3_bucket, s3_key, file_size_bytes, duration_seconds, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['article', articleWithAudioId, 'test-bucket', 'audio/article.mp3', 1000, 60, '2026-01-10T00:00:00.000Z'],
    );
  });

  afterAll(async () => {
    if (db) {
      try {
        await runQuery(db, `DELETE FROM audio_files WHERE source_type = ? AND source_id = ?`, [
          'article',
          articleWithAudioId,
        ]);
        await runQuery(db, `DELETE FROM articles WHERE id IN (?, ?)`, [
          articleWithAudioId,
          articleWithoutAudioId,
        ]);
        await runQuery(db, `DELETE FROM users WHERE id = ?`, [userId]);
      } catch (err) {
        console.error('Failed to clean up seeded rows', err);
      }
    }

    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalJwtSecret;
    }

    if (app) {
      await app.close();
    }
    if (moduleFixture) {
      await moduleFixture.close();
    }
  });

  it('reflects audio_files existence per article', async () => {
    const response = await request(app!.getHttpServer())
      .get('/api/articles')
      .query({ searchTerm: marker })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.articles).toHaveLength(2);

    const withAudio = response.body.articles.find(
      (article: { id: string }) => article.id === articleWithAudioId,
    );
    const withoutAudio = response.body.articles.find(
      (article: { id: string }) => article.id === articleWithoutAudioId,
    );

    expect(withAudio).toBeDefined();
    expect(withoutAudio).toBeDefined();
    expect(withAudio.has_audio).toBe(true);
    expect(withoutAudio.has_audio).toBe(false);
  });
});
