import { ApiKeyAllowed, CurrentUser, type AuthenticatedUser } from '@libs/auth';
import { AudioJobService } from '@libs/audio';
import { QueueService } from '@libs/queue';
import { S3Service } from '@libs/s3';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import {
  ApiAuthErrorResponse,
  ApiValidationErrorResponse,
} from '../shared/swagger/api-error-response.decorators';
import { parseIncludeAudio } from '../shared/helpers/parse-include-audio';
import { ScraperService } from '../scraper/scraper.service';
import { GenerateArticleAudioCommand } from './commands/generate-article-audio.command';
import type { PaginatedArticleInput } from './article.entity';
import { ArticlesService } from './articles.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { GenerateUploadUrlDto } from './dto/generate-upload-url.dto';
import { ProcessMarkdownArticleDto } from './dto/process-markdown-article.dto';
import { GetArticleByIdQuery } from './queries/get-article-by-id.query';
import { ListArticlesQuery } from './queries/list-articles.query';

@Controller('api/articles')
@ApiAuthErrorResponse()
export class ArticlesController {
  constructor(
    private readonly articlesService: ArticlesService,
    private readonly listArticlesQuery: ListArticlesQuery,
    private readonly getArticleByIdQuery: GetArticleByIdQuery,
    private readonly scraperService: ScraperService,
    private readonly queueService: QueueService,
    private readonly s3Service: S3Service,
    private readonly audioJobService: AudioJobService,
    private readonly generateArticleAudioCommand: GenerateArticleAudioCommand,
  ) {}

  @Post()
  @ApiKeyAllowed()
  @ApiOperation({ summary: 'Scrape a URL and queue the resulting article for processing' })
  @ApiCreatedResponse({ description: 'Article scraped and queued for processing' })
  @ApiValidationErrorResponse()
  async create(@Body() createArticleDto: CreateArticleDto) {
    const { url, feedProfile, customPrompt, generateAudio } = createArticleDto;

    try {
      const articleId = await this.scraperService.scrapeSingleArticle(
        url,
        feedProfile,
        customPrompt,
      );

      if (articleId === null) {
        throw new BadRequestException('Article already exists in database');
      }

      const jobInfo = await this.queueService.addArticleProcessingJob(
        articleId,
        feedProfile,
        generateAudio,
      );

      return {
        ...jobInfo,
        message: 'Article scraped and queued for processing',
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      throw new BadRequestException(
        `Failed to scrape article: ${errorMessage}`,
      );
    }
  }

  @Post('upload-url')
  @ApiOperation({ summary: 'Generate a presigned S3 upload URL for an article file' })
  @ApiCreatedResponse({ description: 'Presigned upload URL generated' })
  @ApiValidationErrorResponse()
  async generateUploadUrl(@Body() dto: GenerateUploadUrlDto) {
    const { articleFileName, s3Bucket, contentType, fileSize } = dto;

    try {
      const bucketName = s3Bucket || process.env.S3_ARTICLES_BUCKET_NAME;

      if (!bucketName) {
        throw new BadRequestException(
          'S3 bucket name not provided and S3_ARTICLES_BUCKET_NAME environment variable is not set',
        );
      }

      const result = await this.s3Service.generatePresignedPostUrl(
        bucketName,
        articleFileName,
        contentType,
        fileSize,
      );

      return result;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      throw new BadRequestException(
        `Failed to generate upload URL: ${errorMessage}`,
      );
    }
  }

  @Post('markdown')
  @ApiOperation({ summary: 'Queue a markdown article stored in S3 for processing' })
  @ApiCreatedResponse({ description: 'Markdown article queued for processing' })
  @ApiValidationErrorResponse()
  async processMarkdownArticle(@Body() dto: ProcessMarkdownArticleDto) {
    const { s3Key, feedProfile, s3Bucket, customPrompt, generateAudio } = dto;

    try {
      const bucketName = s3Bucket || process.env.S3_ARTICLES_BUCKET_NAME;

      if (!bucketName) {
        throw new BadRequestException(
          'S3 bucket name not provided and S3_ARTICLES_BUCKET_NAME environment variable is not set',
        );
      }

      const jobInfo = await this.queueService.addMarkdownArticleProcessingJob(
        bucketName,
        s3Key,
        feedProfile,
        customPrompt,
        generateAudio,
      );

      return {
        ...jobInfo,
        message: 'Markdown article queued for processing',
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      throw new BadRequestException(
        `Failed to queue markdown article: ${errorMessage}`,
      );
    }
  }

  @Get('jobs/:jobId')
  @ApiOperation({ summary: 'Get the status of an article processing job' })
  @ApiOkResponse({ description: 'Job status retrieved' })
  @ApiNotFoundResponse({ description: 'Job not found' })
  async getJobStatus(@Param('jobId') jobId: string) {
    try {
      return await this.queueService.getJobStatus(jobId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new BadRequestException('Failed to get job status');
    }
  }

  @Get()
  @ApiOperation({ summary: 'List the authenticated user\'s articles' })
  @ApiOkResponse({ description: 'Paginated list of articles' })
  async listArticles(
    @CurrentUser() user: AuthenticatedUser,
    @Query() input: PaginatedArticleInput,
  ) {
    return await this.listArticlesQuery.execute(user.id, input);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an article by id' })
  @ApiOkResponse({ description: 'Article retrieved' })
  @ApiNotFoundResponse({ description: 'Article not found' })
  async getArticle(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('includeAudio') includeAudio?: string,
  ) {
    const shouldIncludeAudio = parseIncludeAudio(includeAudio);
    const data = await this.getArticleByIdQuery.execute(
      id,
      user.id,
      shouldIncludeAudio,
    );

    if (!data || !data.article) {
      throw new NotFoundException('Article not found');
    }

    return data;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an article by id' })
  @ApiOkResponse({ description: 'Article deleted' })
  async deleteArticle(@Param('id', ParseUUIDPipe) id: string) {
    await this.articlesService.deleteArticleById(id);
    return { success: true };
  }

  @Post(':id/audio')
  @HttpCode(202)
  @ApiOperation({ summary: 'Generate audio for an article' })
  @ApiResponse({ status: 202, description: 'Audio generation job accepted' })
  async generateAudio(@Param('id', ParseUUIDPipe) id: string) {
    return await this.generateArticleAudioCommand.execute(id);
  }

  @Get(':id/audio/status/:jobId')
  @ApiOperation({ summary: 'Get the status of an article audio generation job' })
  @ApiOkResponse({ description: 'Audio job status retrieved' })
  @ApiNotFoundResponse({ description: 'Audio job not found' })
  async getAudioJobStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('jobId') jobId: string,
  ) {
    const jobStatus = await this.audioJobService.getJobStatus(jobId);

    if (!jobStatus || !jobStatus.data || jobStatus.data.sourceId !== id) {
      throw new NotFoundException('Audio job not found');
    }

    return jobStatus;
  }
}
