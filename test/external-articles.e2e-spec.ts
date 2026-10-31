/**
 * E2E Tests for External Articles API Contract
 *
 * Scope: API contract, authentication, validation, feature flag, response structure.
 */
import { RateLimitGuard } from '@libs/auth/rate-limit/rate-limit.guard';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { mock, MockProxy } from 'jest-mock-extended';
import request from 'supertest';
import { App } from 'supertest/types';
import { ExternalArticlesController } from '../src/articles/external-articles.controller';
import { ArticleJobsService } from '../src/articles/services/article-jobs.service';
import { ConfigService } from '../src/config/config.service';
import { ScraperService } from '../src/scraper/scraper.service';
import { FeedProfile } from '../src/shared/types/feed';

describe('External Articles Integration Tests', () => {
  let app: INestApplication<App>;
  let moduleFixture: TestingModule;
  let mockScraperService: MockProxy<ScraperService>;
  let mockArticleJobsService: MockProxy<ArticleJobsService>;
  let mockConfigService: MockProxy<ConfigService>;

  const VALID_TOKEN = 'test-external-token-12345';
  const TEST_URL = 'https://example.com/article';
  const TEST_ARTICLE_ID = 'article-uuid-123';
  const TEST_JOB_ID = 'job-uuid-456';

  // Test configuration
  const originalEnv = process.env;

  beforeAll(async () => {
    process.env = {
      ...originalEnv,
      EXTERNAL_API_TOKENS: VALID_TOKEN,
      EXTERNAL_ARTICLE_SUBMISSION_ENABLED: 'true',
    };

    // Create mock services
    mockScraperService = mock<ScraperService>();
    mockArticleJobsService = mock<ArticleJobsService>();
    mockConfigService = mock<ConfigService>();

    // Setup default mock behavior
    mockConfigService.getAppConfig.mockReturnValue({
      defaultFeedProfile: FeedProfile.DEFAULT,
      maxArticlesForScrapping: 100,
    });
    mockConfigService.isExternalArticleSubmissionEnabled.mockReturnValue(true);
    mockConfigService.getExternalApiTokens.mockReturnValue([VALID_TOKEN]);

    moduleFixture = await Test.createTestingModule({
      controllers: [ExternalArticlesController],
      providers: [
        {
          provide: ScraperService,
          useValue: mockScraperService,
        },
        {
          provide: ArticleJobsService,
          useValue: mockArticleJobsService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    })
      .overrideGuard(RateLimitGuard)
      .useValue({ canActivate: () => true })
      .compile();

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
    // Reset default mock behavior
    mockConfigService.getExternalApiTokens.mockReturnValue([VALID_TOKEN]);
  });

  afterAll(async () => {
    process.env = originalEnv;
    if (app) {
      await app.close();
    }
    await moduleFixture.close();
  });

  describe('POST /api/articles/external', () => {
    describe('Authentication', () => {
      it('should return 401 when X-External-Token header is missing', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/articles/external')
          .send({
            url: TEST_URL,
            feedProfile: FeedProfile.TECHNOLOGY,
          });

        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toContain('Missing X-External-Token header');
      });

      it('should return 401 when X-External-Token header is invalid', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/articles/external')
          .set('X-External-Token', 'invalid-token')
          .send({
            url: TEST_URL,
            feedProfile: FeedProfile.TECHNOLOGY,
          });

        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toContain('Invalid authentication token');
      });

      it('should return 401 when X-External-Token header is empty', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/articles/external')
          .set('X-External-Token', '')
          .send({
            url: TEST_URL,
            feedProfile: FeedProfile.TECHNOLOGY,
          });

        expect(response.status).toBe(401);
      });
    });

    describe('Request Validation', () => {
      it('should return 400 when URL is missing', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/articles/external')
          .set('X-External-Token', VALID_TOKEN)
          .send({
            feedProfile: FeedProfile.TECHNOLOGY,
          });

        expect(response.status).toBe(400);
      });

      it('should return 400 when URL is invalid', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/articles/external')
          .set('X-External-Token', VALID_TOKEN)
          .send({
            url: 'not-a-valid-url',
            feedProfile: FeedProfile.TECHNOLOGY,
          });

        expect(response.status).toBe(400);
      });

      it('should return 400 when feedProfile is missing', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/articles/external')
          .set('X-External-Token', VALID_TOKEN)
          .send({
            url: TEST_URL,
          });

        expect(response.status).toBe(400);
      });

      it('should return 400 when feedProfile is invalid', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/articles/external')
          .set('X-External-Token', VALID_TOKEN)
          .send({
            url: TEST_URL,
            feedProfile: 'invalid-feed',
          });

        expect(response.status).toBe(400);
      });

      it('should return 400 when the body carries a metadata field', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/articles/external')
          .set('X-External-Token', VALID_TOKEN)
          .send({
            url: TEST_URL,
            feedProfile: FeedProfile.TECHNOLOGY,
            metadata: { chatId: '123456789' },
          });

        expect(response.status).toBe(400);
      });

      it('should return 400 when request body is empty', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/articles/external')
          .set('X-External-Token', VALID_TOKEN)
          .send({});

        expect(response.status).toBe(400);
      });
    });

    describe('Valid Requests', () => {
      it('should return 201 when article is successfully submitted', async () => {
        mockScraperService.scrapeSingleArticle.mockResolvedValue(TEST_ARTICLE_ID);
        mockArticleJobsService.addArticleProcessingJob.mockResolvedValue({
          success: true,
          articleFileKey: TEST_ARTICLE_ID,
          jobId: TEST_JOB_ID,
          message: 'Article queued',
        });

        const response = await request(app.getHttpServer())
          .post('/api/articles/external')
          .set('X-External-Token', VALID_TOKEN)
          .send({
            url: TEST_URL,
            feedProfile: FeedProfile.TECHNOLOGY,
          });

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('articleId', TEST_ARTICLE_ID);
        expect(response.body).toHaveProperty('jobId', TEST_JOB_ID);
        expect(response.body).toHaveProperty('message');

        // Verify services were called (customPrompt undefined when not provided - backward compat)
        expect(mockScraperService.scrapeSingleArticle).toHaveBeenCalledWith(
          TEST_URL,
          FeedProfile.TECHNOLOGY,
          undefined,
        );
        expect(mockArticleJobsService.addArticleProcessingJob).toHaveBeenCalledWith(
          TEST_ARTICLE_ID,
          FeedProfile.TECHNOLOGY,
          undefined,
        );
      });

      it('should return 409 when article already exists', async () => {
        mockScraperService.scrapeSingleArticle.mockResolvedValue(null); // Article exists

        const response = await request(app.getHttpServer())
          .post('/api/articles/external')
          .set('X-External-Token', VALID_TOKEN)
          .send({
            url: TEST_URL,
            feedProfile: FeedProfile.TECHNOLOGY,
          });

        expect(response.status).toBe(409);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body.error).toHaveProperty('code', 'ARTICLE_EXISTS');
      });

      it('should return 502 when scraping fails', async () => {
        mockScraperService.scrapeSingleArticle.mockRejectedValue(
          new Error('Failed to extract content'),
        );

        const response = await request(app.getHttpServer())
          .post('/api/articles/external')
          .set('X-External-Token', VALID_TOKEN)
          .send({
            url: TEST_URL,
            feedProfile: FeedProfile.TECHNOLOGY,
          });

        expect(response.status).toBe(502);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body.error).toHaveProperty('code', 'SCRAPE_FAILED');
      });

      it('should handle all valid feed profiles', async () => {
        mockScraperService.scrapeSingleArticle.mockResolvedValue(TEST_ARTICLE_ID);
        mockArticleJobsService.addArticleProcessingJob.mockResolvedValue({
          success: true,
          articleFileKey: TEST_ARTICLE_ID,
          jobId: TEST_JOB_ID,
          message: 'Article queued',
        });

        const feedProfiles = [
          FeedProfile.DEFAULT,
          FeedProfile.TECHNOLOGY,
          FeedProfile.POLITICS,
          FeedProfile.BUSINESS,
          FeedProfile.HEALTH,
          FeedProfile.SCIENCE,
          FeedProfile.BRASIL,
          FeedProfile.TECLAS,
        ];

        for (const feedProfile of feedProfiles) {
          const response = await request(app.getHttpServer())
            .post('/api/articles/external')
            .set('X-External-Token', VALID_TOKEN)
            .send({
              url: TEST_URL,
              feedProfile,
            });

          expect(response.status).toBe(201);
        }
      });

    });

    describe('Feature Flag', () => {
      it('should return 503 when feature is disabled', async () => {
        mockConfigService.isExternalArticleSubmissionEnabled.mockReturnValue(false);

        const response = await request(app.getHttpServer())
          .post('/api/articles/external')
          .set('X-External-Token', VALID_TOKEN)
          .send({
            url: TEST_URL,
            feedProfile: FeedProfile.TECHNOLOGY,
          });

        expect(response.status).toBe(503);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body.error).toHaveProperty('code', 'INTERNAL_ERROR');

        mockConfigService.isExternalArticleSubmissionEnabled.mockReturnValue(true);
      });
    });

    describe('Response Structure', () => {
      it('should return correct success response structure', async () => {
        mockScraperService.scrapeSingleArticle.mockResolvedValue(TEST_ARTICLE_ID);
        mockArticleJobsService.addArticleProcessingJob.mockResolvedValue({
          success: true,
          articleFileKey: TEST_ARTICLE_ID,
          jobId: TEST_JOB_ID,
          message: 'Article queued',
        });

        const response = await request(app.getHttpServer())
          .post('/api/articles/external')
          .set('X-External-Token', VALID_TOKEN)
          .send({
            url: TEST_URL,
            feedProfile: FeedProfile.TECHNOLOGY,
          });

        expect(response.body).toEqual({
          success: true,
          articleId: TEST_ARTICLE_ID,
          jobId: TEST_JOB_ID,
          message: expect.stringContaining('Article submitted successfully'),
        });
      });

      it('should return correct error response structure', async () => {
        mockScraperService.scrapeSingleArticle.mockResolvedValue(null);

        const response = await request(app.getHttpServer())
          .post('/api/articles/external')
          .set('X-External-Token', VALID_TOKEN)
          .send({
            url: TEST_URL,
            feedProfile: FeedProfile.TECHNOLOGY,
          });

        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toHaveProperty('code');
        expect(response.body.error).toHaveProperty('message');
      });
    });
  });
});
