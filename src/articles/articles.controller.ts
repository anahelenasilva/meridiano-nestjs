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
  Req,
} from '@nestjs/common';
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

type AuthenticatedRequest = {
  user: {
    id: string;
  };
};

@Controller('api/articles')
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
  async listArticles(@Query() input: PaginatedArticleInput) {
    return await this.listArticlesQuery.execute(input);
  }

  @Get(':id')
  async getArticle(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('includeAudio') includeAudio?: string,
  ) {
    const shouldIncludeAudio = parseIncludeAudio(includeAudio);
    const data = await this.getArticleByIdQuery.execute(
      id,
      request.user.id,
      shouldIncludeAudio,
    );

    if (!data || !data.article) {
      throw new NotFoundException('Article not found');
    }

    return data;
  }

  @Delete(':id')
  async deleteArticle(@Param('id', ParseUUIDPipe) id: string) {
    await this.articlesService.deleteArticleById(id);
    return { success: true };
  }

  @Post(':id/audio')
  @HttpCode(202)
  async generateAudio(@Param('id', ParseUUIDPipe) id: string) {
    return await this.generateArticleAudioCommand.execute(id);
  }

  @Get(':id/audio/status/:jobId')
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
