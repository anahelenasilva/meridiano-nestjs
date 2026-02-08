import { AudioJobService } from '@libs/audio';
import { QueueService } from '@libs/queue';
import { S3Service } from '@libs/s3';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  forwardRef
} from '@nestjs/common';
import { AudioFilesService } from '../audio-files/audio-files.service';
import { ScraperService } from '../scraper/scraper.service';
import type { PaginatedArticleInput } from './article.entity';
import { ArticlesService } from './articles.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { GenerateUploadUrlDto } from './dto/generate-upload-url.dto';
import { ProcessMarkdownArticleDto } from './dto/process-markdown-article.dto';
import { GetArticleByIdQuery } from './queries/get-article-by-id.query';
import { ListArticlesQuery } from './queries/list-articles.query';

@Controller('api/articles')
export class ArticlesController {
  constructor(
    private readonly articlesService: ArticlesService,
    private readonly listArticlesQuery: ListArticlesQuery,
    private readonly getArticleByIdQuery: GetArticleByIdQuery,
    private readonly scraperService: ScraperService,
    @Inject(forwardRef(() => QueueService))
    private readonly queueService: QueueService,
    private readonly s3Service: S3Service,
    private readonly audioJobService: AudioJobService,
    private readonly audioFilesService: AudioFilesService,
  ) { }

  @Post()
  async create(@Body() createArticleDto: CreateArticleDto) {
    const { url, feedProfile } = createArticleDto;

    try {
      const articleId = await this.scraperService.scrapeSingleArticle(
        url,
        feedProfile,
      );

      if (articleId === null) {
        throw new BadRequestException('Article already exists in database');
      }

      const jobInfo = await this.queueService.addArticleProcessingJob(
        articleId,
        feedProfile,
      );

      return {
        ...jobInfo,
        message: 'Article scraped and queued for processing',
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      const errorMessage = error instanceof Error ?
        error.message :
        'Unknown error occurred';

      throw new BadRequestException(
        `Failed to scrape article: ${errorMessage}`,
      );
    }
  }

  @Post('upload-url')
  async generateUploadUrl(@Body() dto: GenerateUploadUrlDto) {
    const {
      articleFileName,
      s3Bucket,
      contentType,
      fileSize
    } = dto;

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

      const errorMessage = error instanceof Error ?
        error.message :
        'Unknown error occurred';

      throw new BadRequestException(
        `Failed to generate upload URL: ${errorMessage}`,
      );
    }
  }

  @Post('markdown')
  async processMarkdownArticle(@Body() dto: ProcessMarkdownArticleDto) {
    const { s3Key, feedProfile, s3Bucket } = dto;

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
      );

      return {
        ...jobInfo,
        message: 'Markdown article queued for processing',
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      const errorMessage = error instanceof Error ?
        error.message :
        'Unknown error occurred';

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
    @Param('id', ParseUUIDPipe) id: string,
    @Query('includeAudio') includeAudio?: string,
  ) {
    const shouldIncludeAudio = includeAudio === 'true';
    const data = await this.getArticleByIdQuery.execute(id, shouldIncludeAudio);

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
    const article = await this.articlesService.getArticleById(id);

    if (!article) {
      throw new NotFoundException('Article not found');
    }

    const existingAudio = await this.audioFilesService.getAudioFileBySource(
      'article',
      id,
    );

    if (existingAudio) {
      throw new ConflictException(
        'Audio already exists for this article. Use GET /api/articles/:id?includeAudio=true to fetch the audio.',
      );
    }

    // Determine the text to use for TTS: prefer processed_content, fall back to raw_content
    const text = article.processed_content || article.raw_content;

    if (!text) {
      throw new BadRequestException(
        'Article has no content available for audio generation',
      );
    }

    const jobInfo = await this.audioJobService.enqueueAudioJob({
      sourceType: 'article',
      sourceId: id,
      text,
      date: article.published_date,
    });

    return {
      jobId: jobInfo.jobId,
      status: 'queued',
      message: 'Audio generation job queued for article',
    };
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
