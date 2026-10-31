import { Public } from '@libs/auth';
import { RateLimitGuard } from '@libs/auth/rate-limit/rate-limit.guard';
import { RateLimit } from '@libs/auth/rate-limit/rate-limit.decorator';
import { RateLimitRequest } from '@libs/auth/rate-limit/rate-limit.types';
import { JobInfo } from '@libs/queue';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOperation,
  ApiResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiValidationErrorResponse } from '../shared/swagger/api-error-response.decorators';
import { ConfigService } from '../config/config.service';
import { isBlockedIpAddress } from '../scraper/private-address-guard';
import { ScraperService } from '../scraper/scraper.service';
import { FeedProfile } from '../shared/types/feed';
import { ExternalCreateArticleDto } from './dto/external-create-article.dto';
import {
  ExternalArticleErrorCode,
  ExternalArticleResponse,
  EXTERNAL_ERROR_MESSAGES,
} from './dto/external-article-response.dto';
import { ExternalTokenGuard } from './guards/external-token.guard';
import { ArticleJobsService } from './services/article-jobs.service';

const resolveExternalRateLimitKey = (request: RateLimitRequest): string => {
  const tokenHeader = request.headers['x-external-token'];
  const token =
    typeof tokenHeader === 'string'
      ? tokenHeader
      : Array.isArray(tokenHeader)
        ? tokenHeader[0]
        : '';

  if (token.trim()) {
    return `external:token:${token}`;
  }

  const ip =
    request.ip ??
    request.socket?.remoteAddress ??
    request.connection?.remoteAddress ??
    'unknown';
  return `external:ip:${ip}`;
};

@Controller('api/articles/external')
@Public()
@UseGuards(RateLimitGuard, ExternalTokenGuard)
export class ExternalArticlesController {
  private readonly logger = new Logger(ExternalArticlesController.name);

  constructor(
    private readonly scraperService: ScraperService,
    private readonly articleJobsService: ArticleJobsService,
    private readonly configService: ConfigService,
  ) {}

  @Post()
  @RateLimit({
    windowMs: 60 * 1000,
    maxAttempts: 10,
    keyGenerator: resolveExternalRateLimitKey,
  })
  @ApiOperation({
    summary: 'Submit an external article URL for scraping and processing',
  })
  @ApiCreatedResponse({
    description: 'Article submitted successfully and queued for processing',
  })
  @ApiValidationErrorResponse()
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid X-External-Token header',
  })
  @ApiResponse({ status: 409, description: 'Article already exists' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({
    status: 503,
    description: 'External article submission is currently disabled',
  })
  async createExternal(
    @Body() dto: ExternalCreateArticleDto,
  ): Promise<ExternalArticleResponse> {
    if (!this.isFeatureEnabled()) {
      throw new ServiceUnavailableException({
        success: false,
        error: {
          code: ExternalArticleErrorCode.INTERNAL_ERROR,
          message: 'External article submission is currently disabled',
        },
      });
    }

    const {
      url,
      feedProfile,
      customPrompt,
      generateAudio,
      source = 'external',
    } = dto;
    this.assertSafeExternalUrl(url);

    const articleId = await this.scrapeArticleOrThrow(
      url,
      feedProfile,
      customPrompt,
    );

    if (articleId === null) {
      throw new ConflictException({
        success: false,
        error: {
          code: ExternalArticleErrorCode.ARTICLE_EXISTS,
          message:
            EXTERNAL_ERROR_MESSAGES[ExternalArticleErrorCode.ARTICLE_EXISTS],
        },
      });
    }

    const jobInfo = await this.enqueueArticleOrThrow(
      articleId,
      feedProfile,
      generateAudio,
    );

    this.logSubmission({
      source,
      url: this.sanitizeUrl(url),
      feedProfile,
      articleId,
    });

    return {
      success: true,
      jobId: jobInfo.jobId,
      articleId,
      message: 'Article submitted successfully and queued for processing',
    };
  }

  private handleError(
    error: unknown,
    fallback: { code: ExternalArticleErrorCode; status: HttpStatus },
  ): never {
    const mapped = this.mapError(error, fallback);

    this.logger.error(
      `External article submission failed: ${mapped.code}`,
      error,
    );

    throw new HttpException(
      {
        success: false,
        error: {
          code: mapped.code,
          message: mapped.message,
        },
      },
      mapped.status,
    );
  }

  private isFeatureEnabled(): boolean {
    const enabled = this.configService.isExternalArticleSubmissionEnabled();
    return enabled === true;
  }

  private mapError(
    error: unknown,
    fallback: { code: ExternalArticleErrorCode; status: HttpStatus },
  ): { code: ExternalArticleErrorCode; message: string; status: HttpStatus } {
    if (!(error instanceof HttpException)) {
      return {
        code: fallback.code,
        message: EXTERNAL_ERROR_MESSAGES[fallback.code],
        status: fallback.status,
      };
    }

    const statusCode = Number(error.getStatus());
    if (statusCode === 409) {
      return {
        code: ExternalArticleErrorCode.ARTICLE_EXISTS,
        message:
          EXTERNAL_ERROR_MESSAGES[ExternalArticleErrorCode.ARTICLE_EXISTS],
        status: HttpStatus.CONFLICT,
      };
    }

    if (statusCode === 400) {
      return {
        code: ExternalArticleErrorCode.INVALID_URL,
        message: EXTERNAL_ERROR_MESSAGES[ExternalArticleErrorCode.INVALID_URL],
        status: HttpStatus.BAD_REQUEST,
      };
    }

    if (statusCode === 429) {
      return {
        code: ExternalArticleErrorCode.RATE_LIMIT_EXCEEDED,
        message:
          EXTERNAL_ERROR_MESSAGES[ExternalArticleErrorCode.RATE_LIMIT_EXCEEDED],
        status: HttpStatus.TOO_MANY_REQUESTS,
      };
    }

    return {
      code: fallback.code,
      message: EXTERNAL_ERROR_MESSAGES[fallback.code],
      status: fallback.status,
    };
  }

  private assertSafeExternalUrl(url: string): void {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw this.createInvalidUrlException();
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw this.createInvalidUrlException();
    }

    const hostname = parsedUrl.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
      throw this.createInvalidUrlException();
    }

    if (isBlockedIpAddress(hostname)) {
      throw this.createInvalidUrlException();
    }
  }

  private createInvalidUrlException(): BadRequestException {
    return new BadRequestException({
      success: false,
      error: {
        code: ExternalArticleErrorCode.INVALID_URL,
        message: EXTERNAL_ERROR_MESSAGES[ExternalArticleErrorCode.INVALID_URL],
      },
    });
  }

  private async scrapeArticleOrThrow(
    url: string,
    feedProfile: FeedProfile,
    customPrompt?: string,
  ): Promise<string | null> {
    try {
      return await this.scraperService.scrapeSingleArticle(
        url,
        feedProfile,
        customPrompt,
      );
    } catch (error) {
      this.handleError(error, {
        code: ExternalArticleErrorCode.SCRAPE_FAILED,
        status: HttpStatus.BAD_GATEWAY,
      });
    }
  }

  private async enqueueArticleOrThrow(
    articleId: string,
    feedProfile: FeedProfile,
    generateAudio?: boolean,
  ): Promise<JobInfo> {
    try {
      return await this.articleJobsService.addArticleProcessingJob(
        articleId,
        feedProfile,
        generateAudio,
      );
    } catch (error) {
      this.handleError(error, {
        code: ExternalArticleErrorCode.INTERNAL_ERROR,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    }
  }

  private sanitizeUrl(url: string): string {
    try {
      const parsedUrl = new URL(url);
      return `${parsedUrl.origin}${parsedUrl.pathname}`;
    } catch {
      return 'invalid-url';
    }
  }

  private logSubmission(context: {
    source: string;
    url: string;
    feedProfile: string;
    articleId: string;
  }): void {
    this.logger.log({
      message: 'External article submission received',
      level: 'info',
      timestamp: new Date().toISOString(),
      context: {
        source: context.source,
        url: context.url,
        feedProfile: context.feedProfile,
        articleId: context.articleId,
      },
    });
  }
}
