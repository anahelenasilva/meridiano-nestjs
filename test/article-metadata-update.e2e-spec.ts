/**
 * E2E tests for PATCH /api/articles/:id (Article metadata edit).
 *
 * Two seams, matching prior art:
 * - Validation / happy-path / partial-semantics run against the controller with a
 *   mocked ArticlesService (like external-articles.e2e-spec.ts). "Persisted state"
 *   is asserted as the patch the controller hands the service, since e2e has no
 *   real Postgres wired.
 * - Unauthenticated rejection runs against the full AppModule (like
 *   audio-generation-auth.e2e-spec.ts), where the global JwtAuthGuard answers 401
 *   before any handler or DB is reached.
 */
import { AudioJobService } from '@libs/audio';
import { QueueService } from '@libs/queue';
import { S3Service } from '@libs/s3';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { mock, MockProxy } from 'jest-mock-extended';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ArticleCategory, DBArticle } from '../src/articles/article.entity';
import { ArticlesController } from '../src/articles/articles.controller';
import { ArticlesService } from '../src/articles/articles.service';
import { GenerateArticleAudioCommand } from '../src/articles/commands/generate-article-audio.command';
import { GetArticleByIdQuery } from '../src/articles/queries/get-article-by-id.query';
import { ListArticlesQuery } from '../src/articles/queries/list-articles.query';
import { ScraperService } from '../src/scraper/scraper.service';
import { FeedProfile } from '../src/shared/types/feed';

const ARTICLE_ID = '11111111-1111-1111-1111-111111111111';

const existingArticle: DBArticle = {
  id: ARTICLE_ID,
  url: 'https://example.com/article',
  title: 'Original title',
  published_date: new Date('2024-01-01T00:00:00.000Z'),
  feed_source: 'Original Source',
  raw_content: 'raw',
  processed_content: 'processed',
  impact_rating: 5,
  feed_profile: FeedProfile.TECHNOLOGY,
  image_url: null,
  created_at: new Date('2024-01-01T00:00:00.000Z'),
  categories: [ArticleCategory.NEWS],
  custom_prompt: null,
};

describe('PATCH /api/articles/:id (e2e)', () => {
  let app: INestApplication<App>;
  let moduleFixture: TestingModule;
  let mockArticlesService: MockProxy<ArticlesService>;

  beforeAll(async () => {
    mockArticlesService = mock<ArticlesService>();

    moduleFixture = await Test.createTestingModule({
      controllers: [ArticlesController],
      providers: [
        { provide: ArticlesService, useValue: mockArticlesService },
        { provide: ListArticlesQuery, useValue: mock<ListArticlesQuery>() },
        { provide: GetArticleByIdQuery, useValue: mock<GetArticleByIdQuery>() },
        { provide: ScraperService, useValue: mock<ScraperService>() },
        { provide: QueueService, useValue: mock<QueueService>() },
        { provide: S3Service, useValue: mock<S3Service>() },
        { provide: AudioJobService, useValue: mock<AudioJobService>() },
        {
          provide: GenerateArticleAudioCommand,
          useValue: mock<GenerateArticleAudioCommand>(),
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockArticlesService.updateArticle.mockResolvedValue(existingArticle);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    await moduleFixture.close();
  });

  describe('happy path', () => {
    it('returns 200 with the updated article and passes only the touched field', async () => {
      const updated = { ...existingArticle, title: 'Fixed title' };
      mockArticlesService.updateArticle.mockResolvedValue(updated);

      const response = await request(app.getHttpServer())
        .patch(`/api/articles/${ARTICLE_ID}`)
        .send({ title: 'Fixed title' });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: ARTICLE_ID,
        title: 'Fixed title',
      });
      expect(mockArticlesService.updateArticle).toHaveBeenCalledWith(
        ARTICLE_ID,
        { title: 'Fixed title' },
      );
    });

    it('trims a whitespace-padded title before persisting', async () => {
      await request(app.getHttpServer())
        .patch(`/api/articles/${ARTICLE_ID}`)
        .send({ title: '  Padded title  ' })
        .expect(200);

      expect(mockArticlesService.updateArticle).toHaveBeenCalledWith(
        ARTICLE_ID,
        { title: 'Padded title' },
      );
    });

    it('updates several fields in a single request', async () => {
      await request(app.getHttpServer())
        .patch(`/api/articles/${ARTICLE_ID}`)
        .send({
          title: 'New title',
          feedSource: 'TechCrunch',
          feedProfile: FeedProfile.BUSINESS,
        })
        .expect(200);

      expect(mockArticlesService.updateArticle).toHaveBeenCalledWith(
        ARTICLE_ID,
        {
          title: 'New title',
          feedSource: 'TechCrunch',
          feedProfile: FeedProfile.BUSINESS,
        },
      );
    });

    it('leaves omitted fields out of the patch entirely', async () => {
      await request(app.getHttpServer())
        .patch(`/api/articles/${ARTICLE_ID}`)
        .send({ feedSource: 'Will Larson' })
        .expect(200);

      // toEqual ignores undefined-valued keys, so this asserts feedSource is the
      // only *defined* field. The service skips undefined keys when building the
      // SET clause (covered directly in articles.service.spec.ts).
      const patch = mockArticlesService.updateArticle.mock.calls[0][1];
      expect(patch).toEqual({ feedSource: 'Will Larson' });
    });

    it('accepts an empty category list as an explicit two-state clear', async () => {
      await request(app.getHttpServer())
        .patch(`/api/articles/${ARTICLE_ID}`)
        .send({ categories: [] })
        .expect(200);

      expect(mockArticlesService.updateArticle).toHaveBeenCalledWith(
        ARTICLE_ID,
        { categories: [] },
      );
    });

    it('accepts a valid published date in the past', async () => {
      await request(app.getHttpServer())
        .patch(`/api/articles/${ARTICLE_ID}`)
        .send({ publishedDate: '2023-06-15T12:00:00.000Z' })
        .expect(200);

      const patch = mockArticlesService.updateArticle.mock.calls[0][1];
      expect(patch.publishedDate).toBeInstanceOf(Date);
      expect((patch.publishedDate as Date).toISOString()).toBe(
        '2023-06-15T12:00:00.000Z',
      );
    });
  });

  describe('validation (400)', () => {
    it('rejects a future published date', async () => {
      const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      await request(app.getHttpServer())
        .patch(`/api/articles/${ARTICLE_ID}`)
        .send({ publishedDate: future })
        .expect(400);

      expect(mockArticlesService.updateArticle).not.toHaveBeenCalled();
    });

    it('rejects an unknown feed profile', async () => {
      await request(app.getHttpServer())
        .patch(`/api/articles/${ARTICLE_ID}`)
        .send({ feedProfile: 'not-a-profile' })
        .expect(400);
    });

    it('rejects an unknown category value', async () => {
      await request(app.getHttpServer())
        .patch(`/api/articles/${ARTICLE_ID}`)
        .send({ categories: ['news', 'bogus-category'] })
        .expect(400);
    });

    it('rejects a blank title', async () => {
      await request(app.getHttpServer())
        .patch(`/api/articles/${ARTICLE_ID}`)
        .send({ title: '   ' })
        .expect(400);
    });

    it('rejects a blank feed source', async () => {
      await request(app.getHttpServer())
        .patch(`/api/articles/${ARTICLE_ID}`)
        .send({ feedSource: '' })
        .expect(400);
    });

    it('rejects a blank published date', async () => {
      await request(app.getHttpServer())
        .patch(`/api/articles/${ARTICLE_ID}`)
        .send({ publishedDate: '' })
        .expect(400);
    });

    it('rejects a blank feed profile', async () => {
      await request(app.getHttpServer())
        .patch(`/api/articles/${ARTICLE_ID}`)
        .send({ feedProfile: '' })
        .expect(400);
    });

    it('rejects an explicit null on a NOT-NULL field', async () => {
      await request(app.getHttpServer())
        .patch(`/api/articles/${ARTICLE_ID}`)
        .send({ title: null })
        .expect(400);
    });
  });

  describe('id handling', () => {
    it('returns 400 for a malformed id', async () => {
      await request(app.getHttpServer())
        .patch('/api/articles/not-a-uuid')
        .send({ title: 'New title' })
        .expect(400);
    });

    it('returns 404 when the article does not exist', async () => {
      mockArticlesService.updateArticle.mockResolvedValue(null);

      await request(app.getHttpServer())
        .patch(`/api/articles/${ARTICLE_ID}`)
        .send({ title: 'New title' })
        .expect(404);
    });
  });
});

describe('PATCH /api/articles/:id authentication (e2e)', () => {
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

  it('returns 401 with no Authorization header', async () => {
    await request(app.getHttpServer())
      .patch(`/api/articles/${ARTICLE_ID}`)
      .send({ title: 'New title' })
      .expect(401);
  });

  it('returns 401 with an invalid bearer token', async () => {
    await request(app.getHttpServer())
      .patch(`/api/articles/${ARTICLE_ID}`)
      .set('Authorization', 'Bearer invalid-token')
      .send({ title: 'New title' })
      .expect(401);
  });
});
