/**
 * Seeded e2e for GET /api/youtube/transcriptions against a real Postgres
 * database, proving the has_audio EXISTS subquery added to
 * YoutubeTranscriptionsService.getAllTranscriptions round-trips correctly.
 * Everything else about the route (notes attachment, available_channels,
 * response shape) already has coverage elsewhere; this spec only needs to
 * prove the audio_files correlation behaves.
 *
 * Bootstraps the full AppModule like audio-library.e2e-spec.ts and
 * articles-list-has-audio.e2e-spec.ts, since that is the only way to reach a
 * real DatabaseService/DB connection and the real JwtAuthGuard. A user and
 * JWT are minted the same way: JWT_SECRET is set on process.env before the
 * module compiles, then JwtService.sign({ sub, email }).
 *
 * The transcriptions list is unpaginated and unfiltered (no searchTerm), so
 * unlike the articles spec this test cannot scope the response server-side.
 * Instead it looks up its own two seeded rows by id out of whatever the list
 * returns, and cleans up only the rows it inserted (channel, transcriptions,
 * audio_files, user), matching Task 1's narrow-cleanup approach to keep the
 * parallel-worker race over the shared audio_files table minimal.
 */
import { DatabaseConnection, DatabaseService, SqlParams } from '@libs/database';
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
  params: SqlParams,
): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err) => (err ? reject(err) : resolve()));
  });
}

describe('GET /api/youtube/transcriptions has_audio (e2e)', () => {
  let app: INestApplication<App> | undefined;
  let moduleFixture: TestingModule | undefined;
  let db: DatabaseConnection | undefined;
  let originalJwtSecret: string | undefined;
  let token: string;

  const userId = randomUUID();
  const channelId = randomUUID();
  const transcriptionWithAudioId = randomUUID();
  const transcriptionWithoutAudioId = randomUUID();
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
      [
        userId,
        `yt-has-audio-e2e-${userId}@example.com`,
        `yt-has-audio-e2e-${userId}`,
        'unused',
        true,
      ],
    );

    const jwtService = moduleFixture.get(JwtService);
    token = jwtService.sign({
      sub: userId,
      email: `yt-has-audio-e2e-${userId}@example.com`,
    });

    await runQuery(
      db,
      `INSERT INTO youtube_channels (id, channel_id, name, url, enabled)
       VALUES (?, ?, ?, ?, ?)`,
      [
        channelId,
        `UC-${marker}`,
        `Channel ${marker}`,
        `https://www.youtube.com/@${marker}`,
        true,
      ],
    );

    await runQuery(
      db,
      `INSERT INTO youtube_transcriptions (id, channel_id, video_title, video_url, processed_at, transcription_text)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        transcriptionWithAudioId,
        channelId,
        `${marker} - with audio`,
        `https://youtube.com/watch?v=${transcriptionWithAudioId}`,
        '2026-01-01T00:00:00.000Z',
        'transcript text',
      ],
    );
    await runQuery(
      db,
      `INSERT INTO youtube_transcriptions (id, channel_id, video_title, video_url, processed_at, transcription_text)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        transcriptionWithoutAudioId,
        channelId,
        `${marker} - without audio`,
        `https://youtube.com/watch?v=${transcriptionWithoutAudioId}`,
        '2026-01-02T00:00:00.000Z',
        'transcript text',
      ],
    );

    await runQuery(
      db,
      `INSERT INTO audio_files (source_type, source_id, s3_bucket, s3_key, file_size_bytes, duration_seconds, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        'transcription',
        transcriptionWithAudioId,
        'test-bucket',
        'audio/transcription.mp3',
        1000,
        60,
        '2026-01-10T00:00:00.000Z',
      ],
    );
  });

  afterAll(async () => {
    if (db) {
      try {
        await runQuery(
          db,
          `DELETE FROM audio_files WHERE source_type = ? AND source_id = ?`,
          ['transcription', transcriptionWithAudioId],
        );
        await runQuery(db, `DELETE FROM youtube_transcriptions WHERE id IN (?, ?)`, [
          transcriptionWithAudioId,
          transcriptionWithoutAudioId,
        ]);
        await runQuery(db, `DELETE FROM youtube_channels WHERE id = ?`, [
          channelId,
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

  it('reflects audio_files existence per transcription', async () => {
    const response = await request(app!.getHttpServer())
      .get('/api/youtube/transcriptions')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const withAudio = response.body.transcriptions.find(
      (transcription: { id: string }) =>
        transcription.id === transcriptionWithAudioId,
    );
    const withoutAudio = response.body.transcriptions.find(
      (transcription: { id: string }) =>
        transcription.id === transcriptionWithoutAudioId,
    );

    expect(withAudio).toBeDefined();
    expect(withoutAudio).toBeDefined();
    expect(withAudio.has_audio).toBe(true);
    expect(withoutAudio.has_audio).toBe(false);
  });
});
