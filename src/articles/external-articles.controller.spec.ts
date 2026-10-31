import { RateLimitGuard } from '@libs/auth/rate-limit/rate-limit.guard';
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
import { ArticleJobsService } from './services/article-jobs.service';

describe('ExternalArticlesController', () => {
  let controller: ExternalArticlesController;
  let scraperService: jest.Mocked<ScraperService>;
  let articleJobsService: jest.Mocked<ArticleJobsService>;
  let mockConfigService: {
    getAppConfig: jest.Mock;
    isExternalArticleSubmissionEnabled: jest.Mock;
  };

  beforeEach(async () => {
    const mockScraperService = {
      scrapeSingleArticle: jest.fn(),
    };

    const mockArticleJobsService = {
      addArticleProcessingJob: jest.fn(),
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

    controller = module.get<ExternalArticlesController>(
      ExternalArticlesController,
    );
    scraperService = module.get(ScraperService);
    articleJobsService = module.get(ArticleJobsService);
  });

  const validDto = {
    url: 'https://example.com/article',
    feedProfile: FeedProfile.TECHNOLOGY,
    source: 'external',
  };

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // Guards issue #122: private notes must never leak through the public/external
  // article API. The isolation holds by construction, and these tests watch the two
  // pieces of it: no Notes provider reaches the controller, and the success response
  // carries no extra key. Typecheck misses an extra key arriving through a spread.
  describe('note data isolation (issue #122)', () => {
    it('does not inject any Notes provider into the external controller', () => {
      const paramTypes: Array<{ name?: string }> =
        Reflect.getMetadata('design:paramtypes', ExternalArticlesController) ??
        [];
      const dependencyNames = paramTypes.map((type) => type?.name ?? '');

      // Guard against the assertion passing vacuously if metadata is missing.
      expect(dependencyNames.length).toBeGreaterThan(0);
      expect(dependencyNames).not.toContain('');
      expect(dependencyNames.some((name) => /note/i.test(name))).toBe(false);
    });

    it('returns only the documented keys on a successful submission', async () => {
      scraperService.scrapeSingleArticle.mockResolvedValue('article-uuid-123');
      articleJobsService.addArticleProcessingJob.mockResolvedValue({
        success: true,
        articleFileKey: 'article-uuid-123',
        jobId: 'job-uuid-456',
        message: 'Article queued',
      });

      const result = await controller.createExternal(validDto);

      expect(Object.keys(result).sort()).toEqual([
        'articleId',
        'jobId',
        'message',
        'success',
      ]);
    });
  });

  describe('createExternal', () => {
    it('should successfully submit an article', async () => {
      const articleId = 'article-uuid-123';
      const jobId = 'job-uuid-456';

      scraperService.scrapeSingleArticle.mockResolvedValue(articleId);
      articleJobsService.addArticleProcessingJob.mockResolvedValue({
        success: true,
        articleFileKey: articleId,
        jobId,
        message: 'Article queued',
      });

      const result = (await controller.createExternal(
        validDto,
      )) as ExternalArticleSuccessResponse;

      expect(result.success).toBe(true);
      expect(result.articleId).toBe(articleId);
      expect(result.jobId).toBe(jobId);
      expect(scraperService.scrapeSingleArticle).toHaveBeenCalledWith(
        validDto.url,
        validDto.feedProfile,
        undefined,
      );
      expect(articleJobsService.addArticleProcessingJob).toHaveBeenCalledWith(
        articleId,
        validDto.feedProfile,
        undefined,
      );
    });

    it('should return error when article already exists', async () => {
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
            message:
              EXTERNAL_ERROR_MESSAGES[ExternalArticleErrorCode.ARTICLE_EXISTS],
          },
        });
      }
    });

    it('should handle feature disabled', async () => {
      mockConfigService.isExternalArticleSubmissionEnabled.mockReturnValue(
        false,
      );

      await expect(controller.createExternal(validDto)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('should handle scraping failure', async () => {
      scraperService.scrapeSingleArticle.mockRejectedValue(
        new Error('Failed to extract content'),
      );

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
            message:
              EXTERNAL_ERROR_MESSAGES[ExternalArticleErrorCode.SCRAPE_FAILED],
          },
        });
      }
    });

    it('should handle bad request with URL error', async () => {
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
            message:
              EXTERNAL_ERROR_MESSAGES[ExternalArticleErrorCode.ARTICLE_EXISTS],
          },
        });
      }
    });

    it('should handle rate limit exceeded', async () => {
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
            message:
              EXTERNAL_ERROR_MESSAGES[
                ExternalArticleErrorCode.RATE_LIMIT_EXCEEDED
              ],
          },
        });
      }
    });

    it('should handle internal server error', async () => {
      scraperService.scrapeSingleArticle.mockResolvedValue('article-uuid-123');
      articleJobsService.addArticleProcessingJob.mockRejectedValue(
        new Error('Queue down'),
      );

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
            message:
              EXTERNAL_ERROR_MESSAGES[ExternalArticleErrorCode.INTERNAL_ERROR],
          },
        });
      }
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

    it.each([
      'http://[::1]/article',
      'http://[::]/article',
      'http://[::ffff:127.0.0.1]/article',
    ])('should reject the bracketed IPv6 URL %s', async (url) => {
      await expect(
        controller.createExternal({ ...validDto, url }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(scraperService.scrapeSingleArticle).not.toHaveBeenCalled();
    });
  });
});
