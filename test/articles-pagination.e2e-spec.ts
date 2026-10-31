/**
 * E2E for the page/perPage contract of the article listings (issue #331).
 *
 * Validation and coercion happen in the global ValidationPipe against the
 * request DTOs, so neither can be exercised from a controller unit test: these
 * go through HTTP with both list queries mocked, which also keeps the spec off
 * the database.
 */
import { AudioJobService } from '@libs/audio';
import { QueueService } from '@libs/queue';
import { S3Service } from '@libs/s3';
import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock, MockProxy } from 'jest-mock-extended';
import request from 'supertest';
import { App } from 'supertest/types';
import { ArticlesController } from '../src/articles/articles.controller';
import { ArticlesService } from '../src/articles/articles.service';
import { GenerateArticleAudioCommand } from '../src/articles/commands/generate-article-audio.command';
import { GetArticleByIdQuery } from '../src/articles/queries/get-article-by-id.query';
import { ListArticlesLeanQuery } from '../src/articles/queries/list-articles-lean.query';
import { ListArticlesQuery } from '../src/articles/queries/list-articles.query';
import { ArticleJobsService } from '../src/articles/services/article-jobs.service';
import { ConfigService } from '../src/config/config.service';
import { ScraperService } from '../src/scraper/scraper.service';

describe('Article listing pagination (e2e)', () => {
  let app: INestApplication<App>;
  let moduleFixture: TestingModule;
  let listArticlesQuery: MockProxy<ListArticlesQuery>;
  let listArticlesLeanQuery: MockProxy<ListArticlesLeanQuery>;

  beforeAll(async () => {
    listArticlesQuery = mock<ListArticlesQuery>();
    listArticlesLeanQuery = mock<ListArticlesLeanQuery>();

    moduleFixture = await Test.createTestingModule({
      controllers: [ArticlesController],
      providers: [
        { provide: ArticlesService, useValue: mock<ArticlesService>() },
        { provide: ListArticlesQuery, useValue: listArticlesQuery },
        { provide: ListArticlesLeanQuery, useValue: listArticlesLeanQuery },
        { provide: GetArticleByIdQuery, useValue: mock<GetArticleByIdQuery>() },
        { provide: ScraperService, useValue: mock<ScraperService>() },
        { provide: QueueService, useValue: mock<QueueService>() },
        { provide: ArticleJobsService, useValue: mock<ArticleJobsService>() },
        { provide: S3Service, useValue: mock<S3Service>() },
        { provide: AudioJobService, useValue: mock<AudioJobService>() },
        {
          provide: GenerateArticleAudioCommand,
          useValue: mock<GenerateArticleAudioCommand>(),
        },
        { provide: ConfigService, useValue: mock<ConfigService>() },
        {
          provide: APP_GUARD,
          useValue: {
            canActivate: (context: ExecutionContext) => {
              context.switchToHttp().getRequest().user = { id: 'user-1' };
              return true;
            },
          },
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

  afterAll(async () => {
    await app?.close();
    await moduleFixture?.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    listArticlesQuery.execute.mockResolvedValue({
      articles: [],
      pagination: {
        page: 1,
        per_page: 20,
        total_pages: 0,
        total_articles: 0,
      },
    } as never);
    listArticlesLeanQuery.execute.mockResolvedValue({
      articles: [],
    } as never);
  });

  describe('GET /api/articles', () => {
    it('passes page and perPage to the query as numbers', async () => {
      await request(app.getHttpServer())
        .get('/api/articles')
        .query({ page: '2', perPage: '10' })
        .expect(200);

      expect(listArticlesQuery.execute).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ page: 2, perPage: 10 }),
      );
    });

    it('leaves page and perPage to the query defaults when absent', async () => {
      await request(app.getHttpServer()).get('/api/articles').expect(200);

      expect(listArticlesQuery.execute).toHaveBeenCalledWith('user-1', {
        archiveScope: 'active',
      });
    });

    it.each([
      ['perPage=0, which divides total_pages into Infinity', { perPage: '0' }],
      ['a non-numeric perPage, which would reach LIMIT', { perPage: 'abc' }],
      ['perPage above the 100 cap', { perPage: '101' }],
      ['page=0, which makes OFFSET negative', { page: '0' }],
      ['a negative page', { page: '-5' }],
      ['a fractional page', { page: '1.5' }],
      ['page past the 1000000 cap', { page: '1000001' }],
      ['page as 1e18, which overflows bigint OFFSET', { page: '1e18' }],
    ])('rejects %s with a 400', async (_label, query) => {
      await request(app.getHttpServer())
        .get('/api/articles')
        .query(query)
        .expect(400);

      expect(listArticlesQuery.execute).not.toHaveBeenCalled();
    });

    it('still honours archive_scope, which the DTO declares but the handler parses', async () => {
      await request(app.getHttpServer())
        .get('/api/articles')
        .query({ archive_scope: 'archived' })
        .expect(200);

      expect(listArticlesQuery.execute).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ archiveScope: 'archived' }),
      );
    });
  });

  describe('GET /api/articles/lean', () => {
    it('passes page and perPage to the lean query as numbers', async () => {
      await request(app.getHttpServer())
        .get('/api/articles/lean')
        .query({ page: '3', perPage: '5' })
        .expect(200);

      expect(listArticlesLeanQuery.execute).toHaveBeenCalledWith('user-1', {
        page: 3,
        perPage: 5,
      });
    });

    it.each([
      ['perPage=0', { perPage: '0' }],
      ['a non-numeric perPage', { perPage: 'abc' }],
      ['page=0', { page: '0' }],
      ['page as 1e18, which overflows bigint OFFSET', { page: '1e18' }],
    ])('rejects %s with a 400', async (_label, query) => {
      await request(app.getHttpServer())
        .get('/api/articles/lean')
        .query(query)
        .expect(400);

      expect(listArticlesLeanQuery.execute).not.toHaveBeenCalled();
    });
  });
});
