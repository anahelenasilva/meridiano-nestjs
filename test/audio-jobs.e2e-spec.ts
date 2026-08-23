/**
 * E2e for GET /api/audio/jobs. Boots the full AppModule and mints a JWT the
 * same way audio-library.e2e-spec.ts / auth.e2e-spec.ts do.
 *
 * Queue state (waiting/active/delayed/failed jobs) is not deterministically
 * seedable here without reaching into Redis internals, so this spec proves
 * auth (401 without a token) and the response shape (authed 200, `{ jobs: [...] }`).
 * The BullMQ state-to-reported-state mapping is covered deterministically in
 * audio-job.service.spec.ts against a mocked queue.
 */
import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DatabaseConnection, DatabaseService, SqlParams } from '@libs/database';
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

describe('GET /api/audio/jobs (e2e)', () => {
  let app: INestApplication<App> | undefined;
  let moduleFixture: TestingModule | undefined;
  let db: DatabaseConnection | undefined;
  let originalJwtSecret: string | undefined;
  let token: string;

  const userId = randomUUID();

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
      [userId, `audio-jobs-e2e-${userId}@example.com`, `audio-jobs-e2e-${userId}`, 'unused', true],
    );

    const jwtService = moduleFixture.get(JwtService);
    token = jwtService.sign({
      sub: userId,
      email: `audio-jobs-e2e-${userId}@example.com`,
    });
  });

  afterAll(async () => {
    if (db) {
      try {
        await runQuery(db, `DELETE FROM users WHERE id = ?`, [userId]);
      } catch (err) {
         
        console.error('Failed to clean up seeded user', err);
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
    await request(app!.getHttpServer()).get('/api/audio/jobs').expect(401);
  });

  it('returns the jobs envelope when authed', async () => {
    const response = await request(app!.getHttpServer())
      .get('/api/audio/jobs')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(response.body.jobs)).toBe(true);
  });
});
