import { RateLimitGuard } from '@libs/auth/rate-limit/rate-limit.guard';
import { QueueService } from '@libs/queue';
import {
  ConflictException,
  BadRequestException,
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '../config/config.service';
import { ScraperService } from '../scraper/scraper.service';
import { FeedProfile } from '../shared/types/feed';
import { ExternalArticlesController } from './external-articles.controller';
import {
  ExternalArticleErrorCode,
  ExternalArticleSuccessResponse,
  EXTERNAL_ERROR_MESSAGES,
} from './dto/external-article-response.dto';
import { TelegramSubmissionService } from './services/telegram-submission.service';

describe('ExternalArticlesController', () => {
  let controller: ExternalArticlesController;
  let scraperService: jest.Mocked<ScraperService>;
  let queueService: jest.Mocked<QueueService>;
  let telegramSubmissionService: jest.Mocked<TelegramSubmissionService>;
  let mockConfigService: {
    getAppConfig: jest.Mock;
    isExternalArticleSubmissionEnabled: jest.Mock;
  };

  beforeEach(async () => {
    const mockScraperService = {
      scrapeSingleArticle: jest.fn(),
    };

    const mockQueueService = {
      addArticleProcessingJob: jest.fn(),
    };

    const mockTelegramSubmissionService = {
      createSubmission: jest.fn(),
      updateSubmissionStatus: jest.fn().mockResolvedValue(undefined),
    };

    mockConfigService = {
      getAppConfig: jest.fn().mockReturnValue({}),
      isExternalArticleSubmissionEnabled: jest.fn().mockReturnValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
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

    controller = module.get<ExternalArticlesController>(ExternalArticlesController);
    scraperService = module.get(ScraperService);
    queueService = module.get(QueueService);
    telegramSubmissionService = module.get(TelegramSubmissionService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // Guards issue #122: private notes must never leak through the public/external
  // article API. These are regression tripwires — the isolation currently holds
  // by construction, and these tests fail loudly if a future change wires note
  // data into this endpoint.
  describe('note data isolation (issue #122)', () => {
    it('does not inject any Notes provider into the external controller', () => {
      const paramTypes: Array<{ name?: string }> =
        Reflect.getMetadata('design:paramtypes', ExternalArticlesController) ?? [];
      const dependencyNames = paramTypes.map((type) => type?.name ?? '');

      // Guard against the assertion passing vacuously if metadata is missing.
      expect(dependencyNames.length).toBeGreaterThan(0);
      expect(dependencyNames).not.toContain('');
      expect(
        dependencyNames.some((name) => /note/i.test(name)),
      ).toBe(false);
    });

    it('does not expose a note field on the successful submission response', async () => {
      telegramSubmissionService.createSubmission.mockResolvedValue('submission-uuid');
      scraperService.scrapeSingleArticle.mockResolvedValue('article-uuid-123');
      queueService.addArticleProcessingJob.mockResolvedValue({
        success: true,
        articleFileKey: 'article-uuid-123',
        jobId: 'job-uuid-456',
        message: 'Article queued',
      });

      const result = await controller.createExternal({
        url: 'https://example.com/article',
        feedProfile: FeedProfile.TECHNOLOGY,
        source: 'telegram',
        metadata: {
          chatId: '123456789',
          messageId: '456',
          username: '@testuser',
          note: 'Great article about AI',
        },
      });

      expect(result).not.toHaveProperty('note');
    });
  });

  describe('createExternal', () => {
    const validDto = {
      url: 'https://example.com/article',
      feedProfile: FeedProfile.TECHNOLOGY,
      source: 'telegram',
      metadata: {
        chatId: '123456789',
        messageId: '456',
        username: '@testuser',
        note: 'Great article about AI',
      },
    };

    it('should successfully submit an article', async () => {
      const articleId = 'article-uuid-123';
      const jobId = 'job-uuid-456';

      telegramSubmissionService.createSubmission.mockResolvedValue('submission-uuid');
      scraperService.scrapeSingleArticle.mockResolvedValue(articleId);
      queueService.addArticleProcessingJob.mockResolvedValue({
        success: true,
        articleFileKey: articleId,
        jobId,
        message: 'Article queued',
      });

      const result = await controller.createExternal(validDto) as ExternalArticleSuccessResponse;

      expect(result.success).toBe(true);
      expect(result.articleId).toBe(articleId);
      expect(result.jobId).toBe(jobId);
      expect(scraperService.scrapeSingleArticle).toHaveBeenCalledWith(
        validDto.url,
        validDto.feedProfile,
        undefined,
      );
      expect(queueService.addArticleProcessingJob).toHaveBeenCalledWith(
        articleId,
        validDto.feedProfile,
        undefined,
      );
    });

    it('should return error when article already exists', async () => {
      telegramSubmissionService.createSubmission.mockResolvedValue('submission-uuid');
      scraperService.scrapeSingleArticle.mockResolvedValue(null); // Article exists

      try {
        await controller.createExternal(validDto);
        fail('Expected an error to be thrown');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(HttpException);
        const httpError = error as HttpException;
        expect(httpError.getStatus()).toBe(HttpStatus.CONFLICT);
        expect(httpError.getResponse()).toEqual({
          success: false,
          error: {
            code: ExternalArticleErrorCode.ARTICLE_EXISTS,
            message: EXTERNAL_ERROR_MESSAGES[ExternalArticleErrorCode.ARTICLE_EXISTS],
          },
        });
        expect(telegramSubmissionService.updateSubmissionStatus).toHaveBeenCalledWith(
          'submission-uuid',
          'duplicate',
          undefined,
        );
        expect(telegramSubmissionService.updateSubmissionStatus).not.toHaveBeenCalledWith(
          'submission-uuid',
          'failed',
          expect.anything(),
        );
      }
    });

    it('should handle feature disabled', async () => {
      mockConfigService.isExternalArticleSubmissionEnabled.mockReturnValue(false);

      await expect(controller.createExternal(validDto)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('should handle scraping failure', async () => {
      telegramSubmissionService.createSubmission.mockResolvedValue('submission-uuid');
      scraperService.scrapeSingleArticle.mockRejectedValue(new Error('Failed to extract content'));

      try {
        await controller.createExternal(validDto);
        fail('Expected an error to be thrown');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(HttpException);
        const httpError = error as HttpException;
        expect(httpError.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
        expect(httpError.getResponse()).toEqual({
          success: false,
          error: {
            code: ExternalArticleErrorCode.SCRAPE_FAILED,
            message: EXTERNAL_ERROR_MESSAGES[ExternalArticleErrorCode.SCRAPE_FAILED],
          },
        });
      }
    });

    it('should handle bad request with URL error', async () => {
      telegramSubmissionService.createSubmission.mockResolvedValue('submission-uuid');
      scraperService.scrapeSingleArticle.mockRejectedValue(
        new ConflictException('Article already exists in database'),
      );

      try {
        await controller.createExternal(validDto);
        fail('Expected an error to be thrown');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(HttpException);
        const httpError = error as HttpException;
        expect(httpError.getStatus()).toBe(HttpStatus.CONFLICT);
        expect(httpError.getResponse()).toEqual({
          success: false,
          error: {
            code: ExternalArticleErrorCode.ARTICLE_EXISTS,
            message: EXTERNAL_ERROR_MESSAGES[ExternalArticleErrorCode.ARTICLE_EXISTS],
          },
        });
      }
    });

    it('should handle rate limit exceeded', async () => {
      telegramSubmissionService.createSubmission.mockResolvedValue('submission-uuid');
      scraperService.scrapeSingleArticle.mockRejectedValue(
        new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS),
      );

      try {
        await controller.createExternal(validDto);
        fail('Expected an error to be thrown');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(HttpException);
        const httpError = error as HttpException;
        expect(httpError.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        expect(httpError.getResponse()).toEqual({
          success: false,
          error: {
            code: ExternalArticleErrorCode.RATE_LIMIT_EXCEEDED,
            message: EXTERNAL_ERROR_MESSAGES[ExternalArticleErrorCode.RATE_LIMIT_EXCEEDED],
          },
        });
      }
    });

    it('should handle internal server error', async () => {
      telegramSubmissionService.createSubmission.mockResolvedValue('submission-uuid');
      scraperService.scrapeSingleArticle.mockResolvedValue('article-uuid-123');
      queueService.addArticleProcessingJob.mockRejectedValue(new Error('Queue down'));

      try {
        await controller.createExternal(validDto);
        fail('Expected an error to be thrown');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(HttpException);
        const httpError = error as HttpException;
        expect(httpError.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        expect(httpError.getResponse()).toEqual({
          success: false,
          error: {
            code: ExternalArticleErrorCode.INTERNAL_ERROR,
            message: EXTERNAL_ERROR_MESSAGES[ExternalArticleErrorCode.INTERNAL_ERROR],
          },
        });
      }
    });

    it('should continue even if submission record creation fails', async () => {
      telegramSubmissionService.createSubmission.mockRejectedValue(new Error('DB error'));

      const articleId = 'article-uuid-123';
      const jobId = 'job-uuid-456';

      scraperService.scrapeSingleArticle.mockResolvedValue(articleId);
      queueService.addArticleProcessingJob.mockResolvedValue({
        success: true,
        articleFileKey: articleId,
        jobId,
        message: 'Article queued',
      });

      const result = await controller.createExternal(validDto) as ExternalArticleSuccessResponse;

      expect(result.success).toBe(true);
      expect(result.articleId).toBe(articleId);
    });

    it('should continue even if submission status update fails', async () => {
      telegramSubmissionService.createSubmission.mockResolvedValue('submission-uuid');
      telegramSubmissionService.updateSubmissionStatus.mockRejectedValue(
        new Error('DB error'),
      );

      const articleId = 'article-uuid-123';
      const jobId = 'job-uuid-456';

      scraperService.scrapeSingleArticle.mockResolvedValue(articleId);
      queueService.addArticleProcessingJob.mockResolvedValue({
        success: true,
        articleFileKey: articleId,
        jobId,
        message: 'Article queued',
      });

      const result = await controller.createExternal(validDto) as ExternalArticleSuccessResponse;

      expect(result.success).toBe(true);
      expect(result.articleId).toBe(articleId);
      expect(telegramSubmissionService.updateSubmissionStatus).toHaveBeenCalledWith(
        'submission-uuid',
        'success',
        { articleId },
      );
    });

    it('should handle missing optional metadata', async () => {
      const dtoWithoutMetadata = {
        url: 'https://example.com/article',
        feedProfile: FeedProfile.TECHNOLOGY,
      };

      telegramSubmissionService.createSubmission.mockResolvedValue('submission-uuid');

      const articleId = 'article-uuid-123';
      const jobId = 'job-uuid-456';

      scraperService.scrapeSingleArticle.mockResolvedValue(articleId);
      queueService.addArticleProcessingJob.mockResolvedValue({
        success: true,
        articleFileKey: articleId,
        jobId,
        message: 'Article queued',
      });

      const result = await controller.createExternal(dtoWithoutMetadata) as ExternalArticleSuccessResponse;

      expect(result.success).toBe(true);
      expect(telegramSubmissionService.createSubmission).toHaveBeenCalledWith(
        expect.objectContaining({
          chatId: 'unknown',
          messageId: 'unknown',
        }),
      );
    });

    it('should reject localhost URLs', async () => {
      const dto = {
        ...validDto,
        url: 'http://localhost/internal',
      };

      await expect(controller.createExternal(dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('should reject private IPv4 URLs', async () => {
      const dto = {
        ...validDto,
        url: 'http://192.168.1.10/article',
      };

      await expect(controller.createExternal(dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
