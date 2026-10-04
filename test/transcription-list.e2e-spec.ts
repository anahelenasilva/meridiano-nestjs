/**
 * YoutubeTranscriptionsService.listTranscriptions against a real Postgres
 * database. Uses the full AppModule for a live DatabaseService. Every query
 * filters by a seeded channel, so pre-existing local rows never enter the
 * result; cleanup deletes only the seeded rows.
 */
import { DatabaseConnection, DatabaseService, SqlParams } from '@libs/database';
import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import {
  TranscriptionFilter,
  TranscriptionPage,
  YoutubeTranscriptionsService,
} from '../src/youtube-transcriptions/services/youtube-transcriptions.service';

function runQuery(
  db: DatabaseConnection,
  sql: string,
  params: SqlParams,
): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err) => (err ? reject(err) : resolve()));
  });
}

describe('YoutubeTranscriptionsService.listTranscriptions (e2e, real Postgres)', () => {
  let app: INestApplication | undefined;
  let moduleFixture: TestingModule | undefined;
  let db: DatabaseConnection | undefined;
  let service: YoutubeTranscriptionsService;

  const marker = `TranscriptionListE2E-${randomUUID()}`;
  const channelA = randomUUID();
  const channelAExternal = `UC-${marker}-A`;
  const channelB = randomUUID();

  const marchTen = randomUUID();
  const marchTenTwin = randomUUID();
  const unpostedProcessedMarch20 = randomUUID();
  const otherChannel = randomUUID();

  const seeds = [
    { id: marchTen, channel: channelA, postedAt: '2026-03-10T12:00:00.000Z', processedAt: '2026-03-11T00:00:00.000Z' },
    { id: marchTenTwin, channel: channelA, postedAt: '2026-03-10T12:00:00.000Z', processedAt: '2026-03-11T00:00:00.000Z' },
    { id: unpostedProcessedMarch20, channel: channelA, postedAt: null, processedAt: '2026-03-20T00:00:00.000Z' },
    { id: otherChannel, channel: channelB, postedAt: '2026-03-12T12:00:00.000Z', processedAt: '2026-03-13T00:00:00.000Z' },
  ];
  const marchTenPair = [marchTen, marchTenTwin].sort().reverse();

  async function listIds(
    filter: TranscriptionFilter,
    page: TranscriptionPage = { page: 1, perPage: 20 },
  ): Promise<{ ids: string[]; total: number }> {
    const { transcriptions, total } = await service.listTranscriptions(filter, page);
    return { ids: transcriptions.map((transcription) => transcription.id), total };
  }

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    db = moduleFixture.get(DatabaseService).getDbConnection();
    service = moduleFixture.get(YoutubeTranscriptionsService);

    for (const [id, externalId] of [
      [channelA, channelAExternal],
      [channelB, `UC-${marker}-B`],
    ]) {
      await runQuery(
        db,
        `INSERT INTO youtube_channels (id, channel_id, name, url, enabled)
         VALUES (?, ?, ?, ?, ?)`,
        [id, externalId, `Channel ${externalId}`, `https://www.youtube.com/@${externalId}`, true],
      );
    }

    for (const seed of seeds) {
      await runQuery(
        db,
        `INSERT INTO youtube_transcriptions (id, channel_id, video_title, video_url, posted_at, processed_at, transcription_text)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          seed.id,
          seed.channel,
          `${marker} ${seed.id}`,
          `https://youtube.com/watch?v=${seed.id}`,
          seed.postedAt,
          seed.processedAt,
          'transcript text',
        ],
      );
    }
  });

  afterAll(async () => {
    if (db) {
      try {
        await runQuery(
          db,
          `DELETE FROM youtube_transcriptions WHERE id IN (?, ?, ?, ?)`,
          seeds.map((seed) => seed.id),
        );
        await runQuery(db, `DELETE FROM youtube_channels WHERE id IN (?, ?)`, [
          channelA,
          channelB,
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

  it('filters by the internal channel uuid, newest first, ties broken by id', async () => {
    await expect(listIds({ channelId: channelA })).resolves.toEqual({
      ids: [unpostedProcessedMarch20, ...marchTenPair],
      total: 3,
    });
  });

  it('filters by the YouTube channel id the same way', async () => {
    await expect(listIds({ channelId: channelAExternal })).resolves.toEqual({
      ids: [unpostedProcessedMarch20, ...marchTenPair],
      total: 3,
    });
  });

  it('returns an empty page, not an error, for a channel id that matches nothing', async () => {
    await expect(listIds({ channelId: `UC-${marker}-missing` })).resolves.toEqual({
      ids: [],
      total: 0,
    });
  });

  it('dates a transcription with no posted_at by its processed_at', async () => {
    await expect(
      listIds({ channelId: channelA, startDate: '2026-03-15' }),
    ).resolves.toEqual({ ids: [unpostedProcessedMarch20], total: 1 });
  });

  it('includes the whole end date', async () => {
    await expect(
      listIds({ channelId: channelA, endDate: '2026-03-10' }),
    ).resolves.toEqual({ ids: marchTenPair, total: 2 });
  });

  it('returns each row once when paging across equal dates', async () => {
    const pages = await Promise.all(
      [1, 2, 3].map((page) => listIds({ channelId: channelA }, { page, perPage: 1 })),
    );

    expect(pages.flatMap(({ ids }) => ids)).toEqual([
      unpostedProcessedMarch20,
      ...marchTenPair,
    ]);
    expect(pages.map(({ total }) => total)).toEqual([3, 3, 3]);
  });

  it('returns an empty page with the real total past the last page', async () => {
    await expect(
      listIds({ channelId: channelA }, { page: 9, perPage: 20 }),
    ).resolves.toEqual({ ids: [], total: 3 });
  });

  it('reads the summary but not the transcript text or thumbnail', async () => {
    const { transcriptions } = await service.listTranscriptions(
      { channelId: channelA },
      { page: 1, perPage: 20 },
    );

    expect(transcriptions[0]).toHaveProperty('transcriptionSummary');
    expect(transcriptions[0]).not.toHaveProperty('transcriptionText');
    expect(transcriptions[0]).not.toHaveProperty('thumbnailUrl');
  });

  it('reports has_audio and maps dates', async () => {
    const { transcriptions } = await service.listTranscriptions(
      { channelId: channelA },
      { page: 1, perPage: 20 },
    );
    const unposted = transcriptions.find(
      (transcription) => transcription.id === unpostedProcessedMarch20,
    );

    expect(unposted?.has_audio).toBe(false);
    expect(unposted?.postedAt).toBeUndefined();
    // node-pg reads a TIMESTAMP (no time zone) column as local time, so the
    // expected value has no "Z" to keep the test passing outside UTC.
    expect(unposted?.processedAt).toEqual(new Date('2026-03-20T00:00:00.000Z'));
  });
});
