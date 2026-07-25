import { JwtAuthGuard } from '@libs/auth';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock, MockProxy } from 'jest-mock-extended';
import request from 'supertest';
import { App } from 'supertest/types';
import { ArticlesService } from '../src/articles/articles.service';
import { DBArticle } from '../src/articles/article.entity';
import { FeedsController } from '../src/feeds/feeds.controller';
import { GetArticlesFeedQuery } from '../src/feeds/queries/get-articles-feed.query';

describe('Feeds (e2e)', () => {
  let app: INestApplication<App>;
  let moduleFixture: TestingModule;
  let mockArticlesService: MockProxy<ArticlesService>;

  function buildArticle(overrides: Partial<DBArticle> = {}): DBArticle {
    return {
      id: 'article-1',
      url: 'https://source.example.com/article-1',
      title: 'Article One',
      published_date: new Date('2026-07-25T12:00:00.000Z'),
      feed_source: 'example-source',
      raw_content: 'raw body',
      processed_content: 'processed body',
      feed_profile: 'technology',
      created_at: new Date('2026-07-25T12:00:00.000Z'),
      ...overrides,
    };
  }

  beforeAll(async () => {
    mockArticlesService = mock<ArticlesService>();

    // Registers the real, global JwtAuthGuard (as src/app.module.ts does via
    // APP_GUARD) so this test exercises the actual @Public() bypass path,
    // not just the controller's metadata.
    moduleFixture = await Test.createTestingModule({
      controllers: [FeedsController],
      providers: [
        GetArticlesFeedQuery,
        { provide: ArticlesService, useValue: mockArticlesService },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
    await moduleFixture.close();
  });

  describe('GET /feeds/articles.xml', () => {
    it('returns valid RSS XML with the correct content type for an unauthenticated request', async () => {
      const article = buildArticle();
      mockArticlesService.getArticlesPaginated.mockResolvedValue([article]);

      const response = await request(app.getHttpServer())
        .get('/feeds/articles.xml')
        .expect(200);

      expect(response.headers['content-type']).toBe(
        'application/rss+xml; charset=utf-8',
      );
      expect(response.text).toContain(
        '<?xml version="1.0" encoding="UTF-8"?>',
      );
      expect(response.text).toContain(
        `<guid isPermaLink="false">${article.id}</guid>`,
      );
      expect(response.text).toContain(`<title>${article.title}</title>`);
    });

    it('does not require an Authorization header', async () => {
      mockArticlesService.getArticlesPaginated.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/feeds/articles.xml')
        .unset('Authorization')
        .expect(200);
    });
  });
});
