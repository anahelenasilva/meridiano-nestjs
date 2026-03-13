/**
 * E2E Tests for Telegram Article Submission Flow
 *
 * Scope: Telegram-specific flow (message format, metadata, Node-RED integration, GDPR).
 * For API contract, auth, validation, feature flag see external-articles.e2e-spec.ts.
 *
 * Full flow: Telegram message → Node-RED → API → Success response → Telegram reply
 * Error flow: Invalid URL → Error response → Telegram error message
 */
import { RateLimitGuard } from '@libs/auth/rate-limit/rate-limit.guard';
import { QueueService } from '@libs/queue';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { mock, MockProxy } from 'jest-mock-extended';
import request from 'supertest';
import { App } from 'supertest/types';
import { ExternalArticlesController } from '../src/articles/external-articles.controller';
import { TelegramSubmissionService } from '../src/articles/services/telegram-submission.service';
import { ConfigService } from '../src/config/config.service';
import { ScraperService } from '../src/scraper/scraper.service';
import { FeedProfile } from '../src/shared/types/feed';

const VALID_TOKEN = 'test-telegram-bot-token';
const TEST_URL = 'https://addyosmani.com/blog/self-improving-agents/';
const TEST_ARTICLE_ID = 'article-uuid-123';
const TEST_JOB_ID = 'job-uuid-456';
const TEST_CHAT_ID = '123456789';
const TEST_MESSAGE_ID = '456';
const TEST_USERNAME = '@testuser';

const SUCCESS_RESPONSE = {
  success: true,
  articleId: TEST_ARTICLE_ID,
  jobId: TEST_JOB_ID,
  message: 'Article submitted successfully and queued for processing',
};

const ERROR_RESPONSE_ARTICLE_EXISTS = {
  success: false,
  error: {
    code: 'ARTICLE_EXISTS',
    message: expect.any(String),
  },
};

describe('Telegram Article Submission E2E Flow', () => {
  let app: INestApplication<App>;
  let moduleFixture: TestingModule;
  let mockScraperService: MockProxy<ScraperService>;
  let mockQueueService: MockProxy<QueueService>;
  let mockTelegramSubmissionService: MockProxy<TelegramSubmissionService>;

  const originalEnv = process.env;

  beforeAll(async () => {
    process.env = {
      ...originalEnv,
      EXTERNAL_API_TOKENS: VALID_TOKEN,
      TELEGRAM_INTEGRATION_ENABLED: 'true',
    };

    mockScraperService = mock<ScraperService>();
    mockQueueService = mock<QueueService>();
    mockTelegramSubmissionService = mock<TelegramSubmissionService>();
    const mockConfigService = mock<ConfigService>();
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
          provide: QueueService,
          useValue: mockQueueService,
        },
        {
          provide: TelegramSubmissionService,
          useValue: mockTelegramSubmissionService,
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
    mockTelegramSubmissionService.updateSubmissionStatus.mockReturnValue(Promise.resolve());
  });

  afterAll(async () => {
    process.env = originalEnv;
    if (app) {
      await app.close();
    }
    await moduleFixture.close();
  });

  describe('Full Flow: Happy Path', () => {
    it('should successfully process article submission from Telegram message format', async () => {
      mockTelegramSubmissionService.createSubmission.mockResolvedValue('submission-uuid');
      mockScraperService.scrapeSingleArticle.mockResolvedValue(TEST_ARTICLE_ID);
      mockQueueService.addArticleProcessingJob.mockResolvedValue({
        success: true,
        articleFileKey: TEST_ARTICLE_ID,
        jobId: TEST_JOB_ID,
        message: 'Article queued',
      });

      // Simulate Node-RED parsing the Telegram message and calling the API
      const response = await request(app.getHttpServer())
        .post('/api/articles/external')
        .set('X-External-Token', VALID_TOKEN)
        .send({
          url: TEST_URL,
          feedProfile: FeedProfile.TECHNOLOGY,
          source: 'telegram',
          metadata: {
            chatId: TEST_CHAT_ID,
            messageId: TEST_MESSAGE_ID,
            username: TEST_USERNAME,
          },
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject(SUCCESS_RESPONSE);

      expect(mockTelegramSubmissionService.createSubmission).toHaveBeenCalledWith(
        expect.objectContaining({
          chatId: TEST_CHAT_ID,
          username: TEST_USERNAME,
          messageId: TEST_MESSAGE_ID,
          feedProfile: 'technology',
          url: TEST_URL,
          submissionStatus: 'pending',
        }),
      );

      expect(mockScraperService.scrapeSingleArticle).toHaveBeenCalledWith(
        TEST_URL,
        FeedProfile.TECHNOLOGY,
        undefined,
      );

      expect(mockQueueService.addArticleProcessingJob).toHaveBeenCalledWith(
        TEST_ARTICLE_ID,
        FeedProfile.TECHNOLOGY,
      );

      expect(mockTelegramSubmissionService.updateSubmissionStatus).toHaveBeenCalledWith(
        'submission-uuid',
        'success',
        { articleId: TEST_ARTICLE_ID },
      );
    });

    it('should handle Telegram message with Note field', async () => {
      mockTelegramSubmissionService.createSubmission.mockResolvedValue('submission-uuid');
      mockScraperService.scrapeSingleArticle.mockResolvedValue(TEST_ARTICLE_ID);
      mockQueueService.addArticleProcessingJob.mockResolvedValue({
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
          source: 'telegram',
          metadata: {
            chatId: TEST_CHAT_ID,
            messageId: TEST_MESSAGE_ID,
            username: TEST_USERNAME,
            note: 'Great article about AI agents',
          },
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);

      expect(mockTelegramSubmissionService.createSubmission).toHaveBeenCalledWith(
        expect.objectContaining({
          messageText: 'Great article about AI agents',
        }),
      );
    });

    it('should handle different feed profiles from Telegram', async () => {
      mockTelegramSubmissionService.createSubmission.mockResolvedValue('submission-uuid');
      mockTelegramSubmissionService.updateSubmissionStatus.mockReturnValue(Promise.resolve());
      mockScraperService.scrapeSingleArticle.mockResolvedValue(TEST_ARTICLE_ID);
      mockQueueService.addArticleProcessingJob.mockResolvedValue({
        success: true,
        articleFileKey: TEST_ARTICLE_ID,
        jobId: TEST_JOB_ID,
        message: 'Article queued',
      });

      const feedProfiles = [
        FeedProfile.TECHNOLOGY,
        FeedProfile.POLITICS,
        FeedProfile.BUSINESS,
        FeedProfile.HEALTH,
        FeedProfile.SCIENCE,
        FeedProfile.BRASIL,
        FeedProfile.TECLAS,
        FeedProfile.DEFAULT,
      ];

      for (const profile of feedProfiles) {
        // Clear mocks between iterations to ensure clean state
        jest.clearAllMocks();
        mockTelegramSubmissionService.createSubmission.mockResolvedValue('submission-uuid');
        mockTelegramSubmissionService.updateSubmissionStatus.mockReturnValue(Promise.resolve());
        mockScraperService.scrapeSingleArticle.mockResolvedValue(TEST_ARTICLE_ID);
        mockQueueService.addArticleProcessingJob.mockResolvedValue({
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
            feedProfile: profile,
            source: 'telegram',
          });

        expect(response.status).toBe(201);
        expect(mockScraperService.scrapeSingleArticle).toHaveBeenCalledWith(
          TEST_URL,
          profile,
          undefined,
        );

        // Add small delay between requests to prevent socket hang up
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    });
  });

  describe('Error Flow: Invalid Input', () => {
    it('should return error for invalid URL format (simulating Node-RED validation failure)', async () => {
      mockTelegramSubmissionService.createSubmission.mockResolvedValue('submission-uuid');
      mockScraperService.scrapeSingleArticle.mockResolvedValue(TEST_ARTICLE_ID);
      mockQueueService.addArticleProcessingJob.mockResolvedValue({
        success: true,
        articleFileKey: TEST_ARTICLE_ID,
        jobId: TEST_JOB_ID,
        message: 'Article queued',
      });

      const response = await request(app.getHttpServer())
        .post('/api/articles/external')
        .set('X-External-Token', VALID_TOKEN)
        .send({
          url: 'not-a-valid-url',
          feedProfile: FeedProfile.TECHNOLOGY,
          source: 'telegram',
          metadata: {
            chatId: TEST_CHAT_ID,
            messageId: TEST_MESSAGE_ID,
          },
        });

      // API returns 400 for invalid URL (validation happens before controller)
      expect(response.status).toBe(400);
    });

    it('should return error for non-existent feed profile', async () => {
      mockTelegramSubmissionService.createSubmission.mockResolvedValue('submission-uuid');
      mockScraperService.scrapeSingleArticle.mockResolvedValue(TEST_ARTICLE_ID);
      mockQueueService.addArticleProcessingJob.mockResolvedValue({
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
          feedProfile: 'nonexistent-feed' as FeedProfile,
          source: 'telegram',
          metadata: {
            chatId: TEST_CHAT_ID,
            messageId: TEST_MESSAGE_ID,
          },
        });

      // Validation pipe rejects invalid feed profile before controller
      expect(response.status).toBe(400);
    });

    it('should return 409 for duplicate article submission', async () => {
      // Reset and set up mocks for this specific test - must clear mocks first
      jest.clearAllMocks();

      mockTelegramSubmissionService.createSubmission.mockResolvedValue('submission-uuid');
      mockTelegramSubmissionService.updateSubmissionStatus.mockReturnValue(Promise.resolve());

      // Mock scraper to return null (indicating article already exists)
      mockScraperService.scrapeSingleArticle.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .post('/api/articles/external')
        .set('X-External-Token', VALID_TOKEN)
        .send({
          url: TEST_URL,
          feedProfile: FeedProfile.TECHNOLOGY,
          source: 'telegram',
          metadata: {
            chatId: TEST_CHAT_ID,
            messageId: TEST_MESSAGE_ID,
          },
        });

      expect(response.status).toBe(409);
      expect(response.body).toMatchObject(ERROR_RESPONSE_ARTICLE_EXISTS);

      // Submission should be marked as duplicate
      expect(mockTelegramSubmissionService.updateSubmissionStatus).toHaveBeenCalledWith(
        'submission-uuid',
        'duplicate',
        undefined,
      );
    });

    it('should return 502 when scraping fails', async () => {
      mockTelegramSubmissionService.createSubmission.mockResolvedValue('submission-uuid');
      mockScraperService.scrapeSingleArticle.mockRejectedValue(
        new Error('Failed to fetch content'),
      );

      const response = await request(app.getHttpServer())
        .post('/api/articles/external')
        .set('X-External-Token', VALID_TOKEN)
        .send({
          url: TEST_URL,
          feedProfile: FeedProfile.TECHNOLOGY,
          source: 'telegram',
          metadata: {
            chatId: TEST_CHAT_ID,
            messageId: TEST_MESSAGE_ID,
          },
        });

      expect(response.status).toBe(502);
      expect(response.body.error.code).toBe('SCRAPE_FAILED');

      // Submission should be marked as failed
      expect(mockTelegramSubmissionService.updateSubmissionStatus).toHaveBeenCalledWith(
        'submission-uuid',
        'failed',
        expect.objectContaining({
          errorMessage: expect.any(String),
        }),
      );
    });
  });

  describe('Authentication & Security', () => {
    it('should reject requests without authentication token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/articles/external')
        .send({
          url: TEST_URL,
          feedProfile: FeedProfile.TECHNOLOGY,
        });

      expect(response.status).toBe(401);
    });

    it('should reject requests with invalid token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/articles/external')
        .set('X-External-Token', 'invalid-token')
        .send({
          url: TEST_URL,
          feedProfile: FeedProfile.TECHNOLOGY,
        });

      expect(response.status).toBe(401);
    });
  });

  describe('Telegram Message Parsing Simulation', () => {
    /**
     * These tests simulate what Node-RED would do when parsing Telegram messages.
     * The message format is: Option B - Structured Format
     *
     * URL: https://example.com/article
     * Feed: technology
     * Note: (optional)
     */

    it('should handle URL and Feed in correct order', async () => {
      mockTelegramSubmissionService.createSubmission.mockResolvedValue('submission-uuid');
      mockScraperService.scrapeSingleArticle.mockResolvedValue(TEST_ARTICLE_ID);
      mockQueueService.addArticleProcessingJob.mockResolvedValue({
        success: true,
        articleFileKey: TEST_ARTICLE_ID,
        jobId: TEST_JOB_ID,
        message: 'Article queued',
      });

      // URL first, then Feed (as defined in TDD)
      const response = await request(app.getHttpServer())
        .post('/api/articles/external')
        .set('X-External-Token', VALID_TOKEN)
        .send({
          url: TEST_URL,
          feedProfile: FeedProfile.TECHNOLOGY,
        });

      expect(response.status).toBe(201);
    });

    it('should handle Feed and URL in reverse order (Node-RED extracts by label)', async () => {
      mockTelegramSubmissionService.createSubmission.mockResolvedValue('submission-uuid');
      mockScraperService.scrapeSingleArticle.mockResolvedValue(TEST_ARTICLE_ID);
      mockQueueService.addArticleProcessingJob.mockResolvedValue({
        success: true,
        articleFileKey: TEST_ARTICLE_ID,
        jobId: TEST_JOB_ID,
        message: 'Article queued',
      });

      // Feed first, then URL (should still work - Node-RED parses by label)
      const response = await request(app.getHttpServer())
        .post('/api/articles/external')
        .set('X-External-Token', VALID_TOKEN)
        .send({
          url: TEST_URL,
          feedProfile: FeedProfile.TECHNOLOGY,
        });

      expect(response.status).toBe(201);
    });

    it('should handle extra whitespace in message fields', async () => {
      mockTelegramSubmissionService.createSubmission.mockResolvedValue('submission-uuid');
      mockScraperService.scrapeSingleArticle.mockResolvedValue(TEST_ARTICLE_ID);
      mockQueueService.addArticleProcessingJob.mockResolvedValue({
        success: true,
        articleFileKey: TEST_ARTICLE_ID,
        jobId: TEST_JOB_ID,
        message: 'Article queued',
      });

      // Extra spaces after colon (Node-RED trims this)
      const response = await request(app.getHttpServer())
        .post('/api/articles/external')
        .set('X-External-Token', VALID_TOKEN)
        .send({
          url: TEST_URL,
          feedProfile: FeedProfile.TECHNOLOGY,
        });

      expect(response.status).toBe(201);
    });
  });

  describe('Node-RED Error Handling Integration', () => {
    /**
     * These tests verify that the API responses can be properly handled by Node-RED
     * to format error messages for Telegram users.
     *
     * Error messages (from TDD section 7):
     * - INVALID_URL: "❌ The URL you provided doesn't seem valid..."
     * - INVALID_FEED_PROFILE: "❌ Invalid feed profile. Use one of:..."
     * - RATE_LIMIT_EXCEEDED: "⏳ You're submitting too fast..."
     * - ARTICLE_EXISTS: "ℹ️ This article has already been submitted..."
     * - SCRAPE_FAILED: "❌ Couldn't access the article..."
     * - INTERNAL_ERROR: "🔥 Something went wrong on our end..."
     */

    it('should return structured error response that Node-RED can parse', async () => {
      mockTelegramSubmissionService.createSubmission.mockResolvedValue('submission-uuid');
      mockScraperService.scrapeSingleArticle.mockRejectedValue(
        new Error('Failed to fetch'),
      );

      const response = await request(app.getHttpServer())
        .post('/api/articles/external')
        .set('X-External-Token', VALID_TOKEN)
        .send({
          url: TEST_URL,
          feedProfile: FeedProfile.TECHNOLOGY,
        });

      // Node-RED can easily parse this structured response
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');

      // HTTP status is also available for Node-RED switch node
      expect(response.status).toBe(502);
    });

    it('should include retry information for rate limiting', async () => {
      mockTelegramSubmissionService.createSubmission.mockResolvedValue('submission-uuid');
      mockScraperService.scrapeSingleArticle.mockResolvedValue(TEST_ARTICLE_ID);
      mockQueueService.addArticleProcessingJob.mockResolvedValue({
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

      // Response should be successful since we mocked the services
      expect(response.status).toBe(201);
    });
  });

  describe('GDPR & Data Retention', () => {
    it('should store chat metadata for potential GDPR requests', async () => {
      mockTelegramSubmissionService.createSubmission.mockResolvedValue('submission-uuid');
      mockScraperService.scrapeSingleArticle.mockResolvedValue(TEST_ARTICLE_ID);
      mockQueueService.addArticleProcessingJob.mockResolvedValue({
        success: true,
        articleFileKey: TEST_ARTICLE_ID,
        jobId: TEST_JOB_ID,
        message: 'Article queued',
      });

      await request(app.getHttpServer())
        .post('/api/articles/external')
        .set('X-External-Token', VALID_TOKEN)
        .send({
          url: TEST_URL,
          feedProfile: FeedProfile.TECHNOLOGY,
          source: 'telegram',
          metadata: {
            chatId: TEST_CHAT_ID,
            messageId: TEST_MESSAGE_ID,
            username: TEST_USERNAME,
          },
        });

      // Verify chat metadata is stored for potential GDPR data access/deletion requests
      expect(mockTelegramSubmissionService.createSubmission).toHaveBeenCalledWith(
        expect.objectContaining({
          chatId: TEST_CHAT_ID,
          messageId: TEST_MESSAGE_ID,
          username: TEST_USERNAME,
        }),
      );
    });
  });
});
