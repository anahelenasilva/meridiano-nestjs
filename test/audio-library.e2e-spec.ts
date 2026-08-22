/**
 * Seeded e2e for GET /api/audio against a real Postgres database.
 *
 * This is the only place the SQL behavior of AudioFilesService.listAudioLibrary /
 * countAudioLibrary is exercised (Task 1 intentionally ships those without a unit
 * spec): ordering, the created_at/id tie-break, the join back to Articles and
 * YouTube Transcriptions that drops orphaned audio, and the coalesced
 * title/source_label/published_at fields. Everything else about the route
 * (pagination math, response shape) is unit-tested against a mocked service in
 * list-audio-library.query.spec.ts; this spec only needs to prove the database
 * round-trip behaves.
 *
 * Bootstraps the full AppModule like audio-generation-auth.e2e-spec.ts, since
 * that is the only way to reach a real DatabaseService/DB connection and the
 * real JwtAuthGuard. A user and JWT are minted the same way auth.e2e-spec.ts
 * does (JWT_SECRET set on process.env before the module compiles).
 */
import { DatabaseConnection, DatabaseService } from '@libs/database';
import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

// Promise wrapper around the callback-style DatabaseConnection used throughout
// the codebase (see AudioFilesService), so seeding reads like the inserts it
// is standing in for.
function runQuery(
  db: DatabaseConnection,
  sql: string,
  params: unknown[],
): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err) => (err ? reject(err) : resolve()));
  });
}

function allQuery<T>(
  db: DatabaseConnection,
  sql: string,
  params: unknown[],
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve((rows ?? []) as T[])));
  });
}

interface AudioFileRow {
  id: string;
  source_type: string;
  source_id: string;
  s3_bucket: string;
  s3_key: string;
  file_size_bytes: number;
  duration_seconds: number | null;
  created_at: string;
}

// Restores the audio_files snapshot captured in beforeAll. Runs the reinsert
// row-by-row with ON CONFLICT DO NOTHING and swallows per-row errors so that
// one bad row (duplicate key, transient DB error) cannot abort the rest of the
// restore, or the cleanup steps in afterAll that run after it.
async function restoreAudioFiles(
  db: DatabaseConnection,
  rows: AudioFileRow[],
): Promise<void> {
  await runQuery(db, `DELETE FROM audio_files`, []);
  for (const row of rows) {
    try {
      await runQuery(
        db,
        `INSERT INTO audio_files (id, source_type, source_id, s3_bucket, s3_key, file_size_bytes, duration_seconds, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO NOTHING`,
        [
          row.id,
          row.source_type,
          row.source_id,
          row.s3_bucket,
          row.s3_key,
          row.file_size_bytes,
          row.duration_seconds,
          row.created_at,
        ],
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`Failed to restore audio_files row ${row.id}`, err);
    }
  }
}

describe('GET /api/audio (e2e)', () => {
  let app: INestApplication<App> | undefined;
  let moduleFixture: TestingModule | undefined;
  let db: DatabaseConnection | undefined;
  let originalJwtSecret: string | undefined;
  let token: string;
  // GET /api/audio reads the whole audio_files table with no filters, so the
  // exact total_audios assertions below require an empty baseline. This
  // snapshots real local rows before wiping the table and restores them
  // verbatim afterward, rather than standing up an isolated test database
  // (out of scope for this PR). Residual risk: a hard process kill (SIGKILL)
  // between the wipe and the afterAll restore leaves the local audio_files
  // table empty until manually reseeded; the real fix is a disposable e2e DB.
  let preexistingAudioFiles: AudioFileRow[] = [];
  // Gates the afterAll restore: only true once the snapshot below has been
  // captured AND the table wiped, so a beforeAll failure before that point
  // (nothing backed up, nothing deleted) leaves afterAll a no-op on this table
  // instead of deleting rows it never snapshotted.
  let audioFilesWiped = false;

  const userId = randomUUID();
  const channelId = randomUUID();
  const articleId = randomUUID();
  const transcriptionId = randomUUID();
  const orphanSourceId = randomUUID();

  const seededArticle = {
    title: 'Seeded Article Title',
    feedSource: 'Seeded Feed Source',
    publishedDate: '2026-01-01T00:00:00.000Z',
  };
  const seededChannel = {
    name: 'Seeded Channel Name',
  };
  const seededTranscription = {
    videoTitle: 'Seeded Video Title',
    postedAt: '2026-02-01T00:00:00.000Z',
  };

  beforeAll(async () => {
    originalJwtSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-e2e-tests';

    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    db = moduleFixture.get(DatabaseService).getDbConnection();

    // Snapshot must fully land before any DELETE runs: if the SELECT throws,
    // execution never reaches the DELETE below, so nothing is lost.
    preexistingAudioFiles = await allQuery<AudioFileRow>(
      db,
      `SELECT id, source_type, source_id, s3_bucket, s3_key, file_size_bytes, duration_seconds, created_at
       FROM audio_files`,
      [],
    );
    await runQuery(db, `DELETE FROM audio_files`, []);
    audioFilesWiped = true;

    await runQuery(
      db,
      `INSERT INTO users (id, email, username, password, is_email_verified)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, `audio-library-e2e-${userId}@example.com`, `audio-library-e2e-${userId}`, 'unused', true],
    );

    const jwtService = moduleFixture.get(JwtService);
    token = jwtService.sign({
      sub: userId,
      email: `audio-library-e2e-${userId}@example.com`,
    });

    // Article + its audio, older generated audio (should rank second).
    await runQuery(
      db,
      `INSERT INTO articles (id, url, title, published_date, feed_source, raw_content, feed_profile)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        articleId,
        `https://example.com/${articleId}`,
        seededArticle.title,
        seededArticle.publishedDate,
        seededArticle.feedSource,
        'raw content',
        'technology',
      ],
    );

    // Channel + transcription + its audio, newer generated audio (should rank first).
    await runQuery(
      db,
      `INSERT INTO youtube_channels (id, channel_id, name, url, enabled)
       VALUES (?, ?, ?, ?, ?)`,
      [channelId, `ext-${channelId}`, seededChannel.name, 'https://youtube.com/channel/seeded', true],
    );
    await runQuery(
      db,
      `INSERT INTO youtube_transcriptions
         (id, channel_id, video_title, video_url, processed_at, transcription_text, posted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        transcriptionId,
        channelId,
        seededTranscription.videoTitle,
        `https://youtube.com/watch?v=${transcriptionId}`,
        '2026-02-01T00:00:00.000Z',
        'transcript text',
        seededTranscription.postedAt,
      ],
    );

    await runQuery(
      db,
      `INSERT INTO audio_files (source_type, source_id, s3_bucket, s3_key, file_size_bytes, duration_seconds, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['article', articleId, 'test-bucket', 'audio/article.mp3', 1000, 60, '2026-01-10T00:00:00.000Z'],
    );
    await runQuery(
      db,
      `INSERT INTO audio_files (source_type, source_id, s3_bucket, s3_key, file_size_bytes, duration_seconds, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['transcription', transcriptionId, 'test-bucket', 'audio/transcription.mp3', 2000, 120, '2026-01-20T00:00:00.000Z'],
    );
    // Orphan: newest created_at of all three, so it would sort first if the
    // join back to Articles/Transcriptions failed to drop it.
    await runQuery(
      db,
      `INSERT INTO audio_files (source_type, source_id, s3_bucket, s3_key, file_size_bytes, duration_seconds, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['article', orphanSourceId, 'test-bucket', 'audio/orphan.mp3', 500, 30, '2026-01-25T00:00:00.000Z'],
    );
  });

  afterAll(async () => {
    // Restore is best-effort and must never throw past this block: a failure
    // here must not prevent the seeded-row cleanup or app/module teardown
    // below from running.
    if (db && audioFilesWiped) {
      try {
        await restoreAudioFiles(db, preexistingAudioFiles);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to restore audio_files snapshot', err);
      }
    }

    if (db) {
      try {
        await runQuery(db, `DELETE FROM youtube_transcriptions WHERE id = ?`, [transcriptionId]);
        await runQuery(db, `DELETE FROM youtube_channels WHERE id = ?`, [channelId]);
        await runQuery(db, `DELETE FROM articles WHERE id = ?`, [articleId]);
        await runQuery(db, `DELETE FROM users WHERE id = ?`, [userId]);
      } catch (err) {
        // eslint-disable-next-line no-console
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

  it('returns 401 without a bearer token', async () => {
    // beforeAll always assigns app before any `it` runs; Jest guarantees the order.
    await request(app!.getHttpServer()).get('/api/audio').expect(401);
  });

  it('returns the joined library, newest generated audio first, orphan dropped', async () => {
    const response = await request(app!.getHttpServer())
      .get('/api/audio')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.audios).toHaveLength(2);

    const [first, second] = response.body.audios;

    // Newest audio_files.created_at first: the transcription audio (2026-01-20)
    // outranks the article audio (2026-01-10).
    expect(first.source_type).toBe('transcription');
    expect(first.source_id).toBe(transcriptionId);
    expect(second.source_type).toBe('article');
    expect(second.source_id).toBe(articleId);

    for (const item of response.body.audios) {
      expect(item).toHaveProperty('source_type');
      expect(item).toHaveProperty('source_id');
      expect(item).toHaveProperty('title');
      expect(item).toHaveProperty('source_label');
      expect(item).toHaveProperty('published_at');
      expect(item.audio).toMatchObject({
        duration_seconds: expect.any(Number),
        file_size_bytes: expect.any(Number),
      });
      expect(typeof item.audio.presigned_url).toBe('string');
      expect(item.audio.presigned_url.length).toBeGreaterThan(0);
      expect(item.audio).toHaveProperty('created_at');
      expect(item).not.toHaveProperty('s3_key');
      expect(item.audio).not.toHaveProperty('s3_key');
    }

    expect(first.title).toBe(seededTranscription.videoTitle);
    expect(first.source_label).toBe(seededChannel.name);
    expect(second.title).toBe(seededArticle.title);
    expect(second.source_label).toBe(seededArticle.feedSource);

    expect(response.body.pagination).toEqual({
      page: 1,
      per_page: 20,
      total_pages: 1,
      total_audios: 2,
    });
  });

  it('paginates with perPage=1, orphan not counted toward total', async () => {
    const response = await request(app!.getHttpServer())
      .get('/api/audio')
      .query({ page: 1, perPage: 1 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.audios).toHaveLength(1);
    expect(response.body.audios[0].source_type).toBe('transcription');
    expect(response.body.pagination).toEqual({
      page: 1,
      per_page: 1,
      total_pages: 2,
      total_audios: 2,
    });
  });
});
