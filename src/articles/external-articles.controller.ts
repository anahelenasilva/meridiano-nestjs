import { Public } from '@libs/auth';
import { RateLimitGuard } from '@libs/auth/rate-limit/rate-limit.guard';
import { RateLimit } from '@libs/auth/rate-limit/rate-limit.decorator';
import { RateLimitRequest } from '@libs/auth/rate-limit/rate-limit.types';
import { QueueService } from '@libs/queue';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
  Post,
  ServiceUnavailableException,
  UseGuards,
  forwardRef,
} from '@nestjs/common';
import { isIP } from 'net';
import { ConfigService } from '../config/config.service';
import { ScraperService } from '../scraper/scraper.service';
import { FeedProfile } from '../shared/types/feed';
import { ExternalCreateArticleDto } from './dto/external-create-article.dto';
import {
  ExternalArticleErrorCode,
  ExternalArticleResponse,
  EXTERNAL_ERROR_MESSAGES,
} from './dto/external-article-response.dto';
import { ExternalTokenGuard } from './guards/external-token.guard';
import { TelegramSubmissionService } from './services/telegram-submission.service';

const resolveExternalRateLimitKey = (request: RateLimitRequest): string => {
  const tokenHeader = request.headers['x-external-token'];
  const token = typeof tokenHeader === 'string'
    ? tokenHeader
    : Array.isArray(tokenHeader)
      ? tokenHeader[0]
      : '';

  if (token.trim()) {
    return `external:token:${token}`;
  }

  const ip = request.ip ?? request.socket?.remoteAddress ?? request.connection?.remoteAddress ?? 'unknown';
  return `external:ip:${ip}`;
};

@Controller('api/articles/external')
@Public()
@UseGuards(RateLimitGuard, ExternalTokenGuard)
export class ExternalArticlesController {
  private readonly logger = new Logger(ExternalArticlesController.name);

  constructor(
    private readonly scraperService: ScraperService,
    @Inject(forwardRef(() => QueueService))
    private readonly queueService: QueueService,
    private readonly telegramSubmissionService: TelegramSubmissionService,
    private readonly configService: ConfigService,
  ) {}

  @Post()
  @RateLimit({
    windowMs: 60 * 1000,
    maxAttempts: 10,
    keyGenerator: resolveExternalRateLimitKey,
  })
  async createExternal(@Body() dto: ExternalCreateArticleDto): Promise<ExternalArticleResponse> {
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
      metadata,
    } = dto;
    this.assertSafeExternalUrl(url);

    const submissionMetadata = {
      // Default to 'unknown' for chatId and messageId to ensure submission record
      // can be created even if metadata is missing. This allows graceful handling
      // of non-Telegram sources or misconfigured clients.
      chatId: metadata?.chatId || 'unknown',
      username: metadata?.username,
      messageId: metadata?.messageId || 'unknown',
      messageText: metadata?.note,
    };

    let submissionId: string | null = null;
    try {
      submissionId = await this.telegramSubmissionService.createSubmission({
        chatId: submissionMetadata.chatId,
        username: submissionMetadata.username,
        messageId: submissionMetadata.messageId,
        messageText: submissionMetadata.messageText,
        feedProfile,
        url,
        submissionStatus: 'pending',
      });
    } catch (error) {
      // Graceful degradation: If submission record creation fails, log the error
      // but continue processing the article. This ensures the article submission
      // still works even if the analytics database has issues.
      this.logger.error('Failed to create submission record', error);
    }

    const articleId = await this.scrapeArticleOrThrow(
      url,
      feedProfile,
      submissionId,
      customPrompt,
    );

    if (articleId === null) {
      if (submissionId) {
        await this.safeUpdateSubmissionStatus(submissionId, 'duplicate');
      }

      throw new ConflictException({
        success: false,
        error: {
          code: ExternalArticleErrorCode.ARTICLE_EXISTS,
          message: EXTERNAL_ERROR_MESSAGES[ExternalArticleErrorCode.ARTICLE_EXISTS],
        },
      });
    }

    const jobInfo = await this.enqueueArticleOrThrow(
      articleId,
      feedProfile,
      submissionId,
      generateAudio,
    );

    if (submissionId) {
      await this.safeUpdateSubmissionStatus(submissionId, 'success', {
        articleId,
      });
    }

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

  private async handleError(
    error: unknown,
    submissionId: string | null,
    fallback: { code: ExternalArticleErrorCode; status: HttpStatus },
  ): Promise<never> {
    const mapped = this.mapError(error, fallback);

    if (submissionId && mapped.code !== ExternalArticleErrorCode.ARTICLE_EXISTS) {
      await this.safeUpdateSubmissionStatus(submissionId, 'failed', {
        errorMessage: mapped.message,
      });
    }

    this.logger.error(`External article submission failed: ${mapped.code}`, error);

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
        message: EXTERNAL_ERROR_MESSAGES[ExternalArticleErrorCode.ARTICLE_EXISTS],
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
        message: EXTERNAL_ERROR_MESSAGES[ExternalArticleErrorCode.RATE_LIMIT_EXCEEDED],
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

    if (this.isBlockedIpAddress(hostname)) {
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

  private isBlockedIpAddress(host: string): boolean {
    const ipVersion = isIP(host);
    if (ipVersion === 4) {
      const octets = host.split('.').map((segment) => Number.parseInt(segment, 10));
      const first = octets[0];
      const second = octets[1];

      if (host === '100.100.100.200') {
        return true;
      }

      return (
        first === 0 ||
        first === 10 ||
        first === 127 ||
        (first === 169 && second === 254) ||
        (first === 172 && second >= 16 && second <= 31) ||
        (first === 192 && second === 168)
      );
    }

    if (ipVersion === 6) {
      const normalizedHost = host.toLowerCase();
      if (normalizedHost === '::1') {
        return true;
      }

      if (normalizedHost.startsWith('fc') || normalizedHost.startsWith('fd')) {
        return true;
      }

      if (
        normalizedHost.startsWith('fe8') ||
        normalizedHost.startsWith('fe9') ||
        normalizedHost.startsWith('fea') ||
        normalizedHost.startsWith('feb')
      ) {
        return true;
      }

      if (normalizedHost.startsWith('::ffff:')) {
        const ipv4Part = normalizedHost.replace('::ffff:', '');
        return this.isBlockedIpAddress(ipv4Part);
      }
    }

    return false;
  }

  private async scrapeArticleOrThrow(
    url: string,
    feedProfile: FeedProfile,
    submissionId: string | null,
    customPrompt?: string,
  ): Promise<string | null> {
    try {
      return await this.scraperService.scrapeSingleArticle(
        url,
        feedProfile,
        customPrompt,
      );
    } catch (error) {
      await this.handleError(error, submissionId, {
        code: ExternalArticleErrorCode.SCRAPE_FAILED,
        status: HttpStatus.BAD_GATEWAY,
      });
    }
    throw new Error('Unreachable');
  }

  private async enqueueArticleOrThrow(
    articleId: string,
    feedProfile: FeedProfile,
    submissionId: string | null,
    generateAudio?: boolean,
  ): Promise<Awaited<ReturnType<QueueService['addArticleProcessingJob']>>> {
    try {
      return await this.queueService.addArticleProcessingJob(
        articleId,
        feedProfile,
        generateAudio,
      );
    } catch (error) {
      await this.handleError(error, submissionId, {
        code: ExternalArticleErrorCode.INTERNAL_ERROR,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    }
    throw new Error('Unreachable');
  }

  private async safeUpdateSubmissionStatus(
    submissionId: string,
    status: 'success' | 'failed' | 'duplicate',
    options?: { articleId?: string; errorMessage?: string },
  ): Promise<void> {
    try {
      await this.telegramSubmissionService.updateSubmissionStatus(submissionId, status, options);
    } catch (error) {
      this.logger.error('Failed to update submission status', error);
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
