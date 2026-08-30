/**
 * E2E tests for POST and DELETE /api/articles/:id/archive.
 *
 * Same seam as article-metadata-update.e2e-spec.ts: the controller runs against
 * a mocked ArticlesService, because e2e has no real Postgres. Idempotence is
 * asserted at the HTTP boundary (a second call still succeeds and the timestamp
 * does not move); the COALESCE that guarantees it is covered by the unit test.
 */
import { AudioJobService } from '@libs/audio';
import { QueueService } from '@libs/queue';
import { S3Service } from '@libs/s3';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { mock, MockProxy } from 'jest-mock-extended';
import request from 'supertest';
import { App } from 'supertest/types';
import { DBArticle } from '../src/articles/article.entity';
import { ArticlesController } from '../src/articles/articles.controller';
import { ArticlesService } from '../src/articles/articles.service';
import { GenerateArticleAudioCommand } from '../src/articles/commands/generate-article-audio.command';
import { GetArticleByIdQuery } from '../src/articles/queries/get-article-by-id.query';
import { ListArticlesLeanQuery } from '../src/articles/queries/list-articles-lean.query';
import { ListArticlesQuery } from '../src/articles/queries/list-articles.query';
import { ConfigService } from '../src/config/config.service';
import { ScraperService } from '../src/scraper/scraper.service';
import { FeedProfile } from '../src/shared/types/feed';

const ARTICLE_ID = '11111111-1111-1111-1111-111111111111';
const ARCHIVED_AT = new Date('2026-06-01T09:00:00.000Z');

function article(archivedAt: Date | null): DBArticle {
  return {
    id: ARTICLE_ID,
    url: 'https://example.com/article',
    title: 'Title',
    published_date: new Date('2026-05-01T00:00:00.000Z'),
    feed_source: 'Source',
    raw_content: 'raw',
    processed_content: 'processed',
    impact_rating: 5,
    feed_profile: FeedProfile.TECHNOLOGY,
    image_url: null,
    created_at: new Date('2026-05-01T00:00:00.000Z'),
    categories: null,
    custom_prompt: null,
    archived_at: archivedAt,
  };
}

describe('Article archive endpoints (e2e)', () => {
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
        {
          provide: ListArticlesLeanQuery,
          useValue: mock<ListArticlesLeanQuery>(),
        },
        { provide: GetArticleByIdQuery, useValue: mock<GetArticleByIdQuery>() },
        { provide: ScraperService, useValue: mock<ScraperService>() },
        { provide: QueueService, useValue: mock<QueueService>() },
        { provide: S3Service, useValue: mock<S3Service>() },
        { provide: AudioJobService, useValue: mock<AudioJobService>() },
        {
          provide: GenerateArticleAudioCommand,
          useValue: mock<GenerateArticleAudioCommand>(),
        },
        { provide: ConfigService, useValue: mock<ConfigService>() },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('archives an article and returns it with archived_at set', async () => {
    mockArticlesService.archiveArticle.mockResolvedValue(article(ARCHIVED_AT));

    const response = await request(app.getHttpServer())
      .post(`/api/articles/${ARTICLE_ID}/archive`)
      .expect(201);

    expect(response.body.archived_at).toBe(ARCHIVED_AT.toISOString());
    expect(mockArticlesService.archiveArticle).toHaveBeenCalledWith(ARTICLE_ID);
  });

  it('is idempotent: a second archive succeeds and leaves the timestamp unchanged', async () => {
    mockArticlesService.archiveArticle.mockResolvedValue(article(ARCHIVED_AT));

    const first = await request(app.getHttpServer())
      .post(`/api/articles/${ARTICLE_ID}/archive`)
      .expect(201);
    const second = await request(app.getHttpServer())
      .post(`/api/articles/${ARTICLE_ID}/archive`)
      .expect(201);

    expect(second.body.archived_at).toBe(first.body.archived_at);
  });

  it('unarchives an article and returns it with a null archived_at', async () => {
    mockArticlesService.unarchiveArticle.mockResolvedValue(article(null));

    const response = await request(app.getHttpServer())
      .delete(`/api/articles/${ARTICLE_ID}/archive`)
      .expect(200);

    expect(response.body.archived_at).toBeNull();
  });

  it('is idempotent: unarchiving an active article still succeeds', async () => {
    mockArticlesService.unarchiveArticle.mockResolvedValue(article(null));

    await request(app.getHttpServer())
      .delete(`/api/articles/${ARTICLE_ID}/archive`)
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/api/articles/${ARTICLE_ID}/archive`)
      .expect(200);
  });

  it('returns 404 for an unknown article on both verbs', async () => {
    mockArticlesService.archiveArticle.mockResolvedValue(null);
    mockArticlesService.unarchiveArticle.mockResolvedValue(null);

    await request(app.getHttpServer())
      .post(`/api/articles/${ARTICLE_ID}/archive`)
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/api/articles/${ARTICLE_ID}/archive`)
      .expect(404);
  });

  it('rejects a malformed archive_scope on the list endpoint with a 400', async () => {
    await request(app.getHttpServer())
      .get('/api/articles?archive_scope=deleted')
      .expect(400);
  });
});
