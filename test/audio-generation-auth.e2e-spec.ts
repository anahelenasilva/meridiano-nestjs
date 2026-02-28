import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

const ARTICLE_ID = '11111111-1111-1111-1111-111111111111';
const TRANSCRIPTION_ID = '22222222-2222-2222-2222-222222222222';

describe('Audio generation endpoints authentication (e2e)', () => {
  let app: INestApplication<App>;
  let moduleFixture: TestingModule;

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (app) {
      await app.close();
    }
  });

  describe('POST /api/articles/:id/audio', () => {
    it('should return 401 when request has no Authorization header', async () => {
      await request(app.getHttpServer())
        .post(`/api/articles/${ARTICLE_ID}/audio`)
        .expect(401);
    });

    it('should return 401 when request has invalid Authorization header', async () => {
      await request(app.getHttpServer())
        .post(`/api/articles/${ARTICLE_ID}/audio`)
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('POST /api/youtube/transcriptions/:id/audio', () => {
    it('should return 401 when request has no Authorization header', async () => {
      await request(app.getHttpServer())
        .post(`/api/youtube/transcriptions/${TRANSCRIPTION_ID}/audio`)
        .expect(401);
    });

    it('should return 401 when request has invalid Authorization header', async () => {
      await request(app.getHttpServer())
        .post(`/api/youtube/transcriptions/${TRANSCRIPTION_ID}/audio`)
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });
});
