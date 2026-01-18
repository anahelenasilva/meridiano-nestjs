import { Test, TestingModule } from '@nestjs/testing';
import { Job, Worker } from 'bullmq';
import { mock, mockReset } from 'jest-mock-extended';
import { ArticlesService } from '../../articles/articles.service';
import { ProcessorService } from '../../processor/processor.service';
import { S3Service } from '../../s3/s3.service';
import { FeedProfile } from '../../shared/types/feed';
import { ProcessMarkdownArticleJobData } from '../interfaces/markdown-article-job.interface';
import { RedisService } from '../redis.service';
import { MarkdownArticleProcessor } from './markdown-article.processor';

jest.mock('bullmq');

describe('MarkdownArticleProcessor', () => {
  let processor: MarkdownArticleProcessor;
  const mockRedisService = mock<RedisService>();
  const mockS3Service = mock<S3Service>();
  const mockArticlesService = mock<ArticlesService>();
  const mockProcessorService = mock<ProcessorService>();
  const mockWorker = mock<Worker>();

  beforeEach(async () => {
    (Worker as unknown as jest.Mock).mockImplementation(() => mockWorker);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarkdownArticleProcessor,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: S3Service,
          useValue: mockS3Service,
        },
        {
          provide: ArticlesService,
          useValue: mockArticlesService,
        },
        {
          provide: ProcessorService,
          useValue: mockProcessorService,
        },
      ],
    }).compile();

    processor = module.get<MarkdownArticleProcessor>(MarkdownArticleProcessor);
    mockReset(mockRedisService);
    mockReset(mockS3Service);
    mockReset(mockArticlesService);
    mockReset(mockProcessorService);
    mockReset(mockWorker);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should initialize worker correctly', () => {
      processor.onModuleInit();

      expect(Worker).toHaveBeenCalledTimes(1);
      expect(mockWorker.on).toHaveBeenCalledWith('completed', expect.any(Function));
      expect(mockWorker.on).toHaveBeenCalledWith('failed', expect.any(Function));
    });
  });

  describe('processMarkdownArticle', () => {
    const mockJobData: ProcessMarkdownArticleJobData = {
      s3Bucket: 'test-bucket',
      s3Key: 'test-file.md',
      feedProfile: FeedProfile.DEFAULT,
    };

    const mockJob = {
      id: 'test-job-id',
      data: mockJobData,
    } as Job<ProcessMarkdownArticleJobData>;

    it('should successfully process markdown article', async () => {
      const markdownContent = '# Test Title\n\nTest content.';
      const articleId = 'article-123';

      mockS3Service.downloadMarkdownFile.mockResolvedValueOnce(markdownContent);
      mockArticlesService.addArticle.mockResolvedValueOnce(articleId);
      mockProcessorService.processArticles.mockResolvedValueOnce({
        feedProfile: FeedProfile.DEFAULT,
        articlesProcessed: 1,
        articlesRated: 0,
        articlesCategorized: 0,
        errors: 0,
        startTime: new Date(),
      });
      mockProcessorService.rateArticles.mockResolvedValueOnce({
        feedProfile: FeedProfile.DEFAULT,
        articlesProcessed: 0,
        articlesRated: 1,
        articlesCategorized: 0,
        errors: 0,
        startTime: new Date(),
      });
      mockProcessorService.categorizeArticles.mockResolvedValueOnce({
        feedProfile: FeedProfile.DEFAULT,
        articlesProcessed: 0,
        articlesRated: 0,
        articlesCategorized: 1,
        errors: 0,
        startTime: new Date(),
      });

      const result = await processor.processMarkdownArticle(mockJob);

      expect(mockS3Service.downloadMarkdownFile).toHaveBeenCalledWith(
        'test-bucket',
        'test-file.md',
      );
      expect(mockArticlesService.addArticle).toHaveBeenCalledWith(
        's3://test-bucket/test-file.md',
        'Test Title',
        expect.any(Date),
        'S3 Upload',
        markdownContent,
        FeedProfile.DEFAULT,
      );
      expect(mockProcessorService.processArticles).toHaveBeenCalledWith(
        FeedProfile.DEFAULT,
        1,
        articleId,
      );
      expect(mockProcessorService.rateArticles).toHaveBeenCalledWith(
        FeedProfile.DEFAULT,
        1,
        articleId,
      );
      expect(mockProcessorService.categorizeArticles).toHaveBeenCalledWith(
        FeedProfile.DEFAULT,
        1,
        articleId,
      );
      expect(result).toEqual({
        success: true,
        message: expect.stringContaining('test-file.md'),
      });
    });

    it('should handle S3 download failure', async () => {
      const error = new Error('S3 download failed');
      mockS3Service.downloadMarkdownFile.mockRejectedValueOnce(error);

      await expect(processor.processMarkdownArticle(mockJob)).rejects.toThrow(
        'Markdown article processing failed for test-file.md',
      );

      expect(mockArticlesService.addArticle).not.toHaveBeenCalled();
    });

    it('should handle markdown parsing failure', async () => {
      const markdownContent = 'No H1 heading here';
      mockS3Service.downloadMarkdownFile.mockResolvedValueOnce(markdownContent);

      await expect(processor.processMarkdownArticle(mockJob)).rejects.toThrow();

      expect(mockArticlesService.addArticle).not.toHaveBeenCalled();
    });

    it('should handle article creation failure when returns null', async () => {
      const markdownContent = '# Test Title\n\nTest content.';
      mockS3Service.downloadMarkdownFile.mockResolvedValueOnce(markdownContent);
      mockArticlesService.addArticle.mockResolvedValueOnce(null);

      await expect(processor.processMarkdownArticle(mockJob)).rejects.toThrow(
        'Failed to create article (duplicate or database error)',
      );

      expect(mockProcessorService.processArticles).not.toHaveBeenCalled();
    });

    it('should handle article creation failure when throws error', async () => {
      const markdownContent = '# Test Title\n\nTest content.';
      const error = new Error('Database error');
      mockS3Service.downloadMarkdownFile.mockResolvedValueOnce(markdownContent);
      mockArticlesService.addArticle.mockRejectedValueOnce(error);

      await expect(processor.processMarkdownArticle(mockJob)).rejects.toThrow();

      expect(mockProcessorService.processArticles).not.toHaveBeenCalled();
    });

    it('should handle processing failure', async () => {
      const markdownContent = '# Test Title\n\nTest content.';
      const articleId = 'article-123';
      mockS3Service.downloadMarkdownFile.mockResolvedValueOnce(markdownContent);
      mockArticlesService.addArticle.mockResolvedValueOnce(articleId);
      mockProcessorService.processArticles.mockResolvedValueOnce({
        feedProfile: FeedProfile.DEFAULT,
        articlesProcessed: 0,
        articlesRated: 0,
        articlesCategorized: 0,
        errors: 1,
        startTime: new Date(),
      });

      await expect(processor.processMarkdownArticle(mockJob)).rejects.toThrow(
        'Failed to process article',
      );

      expect(mockProcessorService.rateArticles).not.toHaveBeenCalled();
    });

    it('should handle rating failure', async () => {
      const markdownContent = '# Test Title\n\nTest content.';
      const articleId = 'article-123';
      mockS3Service.downloadMarkdownFile.mockResolvedValueOnce(markdownContent);
      mockArticlesService.addArticle.mockResolvedValueOnce(articleId);
      mockProcessorService.processArticles.mockResolvedValueOnce({
        feedProfile: FeedProfile.DEFAULT,
        articlesProcessed: 1,
        articlesRated: 0,
        articlesCategorized: 0,
        errors: 0,
        startTime: new Date(),
      });
      mockProcessorService.rateArticles.mockResolvedValueOnce({
        feedProfile: FeedProfile.DEFAULT,
        articlesProcessed: 0,
        articlesRated: 0,
        articlesCategorized: 0,
        errors: 1,
        startTime: new Date(),
      });

      await expect(processor.processMarkdownArticle(mockJob)).rejects.toThrow(
        'Failed to rate article',
      );

      expect(mockProcessorService.categorizeArticles).not.toHaveBeenCalled();
    });

    it('should handle categorization failure', async () => {
      const markdownContent = '# Test Title\n\nTest content.';
      const articleId = 'article-123';
      mockS3Service.downloadMarkdownFile.mockResolvedValueOnce(markdownContent);
      mockArticlesService.addArticle.mockResolvedValueOnce(articleId);
      mockProcessorService.processArticles.mockResolvedValueOnce({
        feedProfile: FeedProfile.DEFAULT,
        articlesProcessed: 1,
        articlesRated: 0,
        articlesCategorized: 0,
        errors: 0,
        startTime: new Date(),
      });
      mockProcessorService.rateArticles.mockResolvedValueOnce({
        feedProfile: FeedProfile.DEFAULT,
        articlesProcessed: 0,
        articlesRated: 1,
        articlesCategorized: 0,
        errors: 0,
        startTime: new Date(),
      });
      mockProcessorService.categorizeArticles.mockResolvedValueOnce({
        feedProfile: FeedProfile.DEFAULT,
        articlesProcessed: 0,
        articlesRated: 0,
        articlesCategorized: 0,
        errors: 1,
        startTime: new Date(),
      });

      await expect(processor.processMarkdownArticle(mockJob)).rejects.toThrow(
        'Failed to categorize article',
      );
    });

    it('should process article with different feed profile', async () => {
      const jobDataWithDifferentProfile: ProcessMarkdownArticleJobData = {
        ...mockJobData,
        feedProfile: FeedProfile.TECHNOLOGY,
      };
      const jobWithDifferentProfile = {
        ...mockJob,
        data: jobDataWithDifferentProfile,
      } as Job<ProcessMarkdownArticleJobData>;

      const markdownContent = '# Tech Article\n\nTech content.';
      const articleId = 'article-456';

      mockS3Service.downloadMarkdownFile.mockResolvedValueOnce(markdownContent);
      mockArticlesService.addArticle.mockResolvedValueOnce(articleId);
      mockProcessorService.processArticles.mockResolvedValueOnce({
        feedProfile: FeedProfile.TECHNOLOGY,
        articlesProcessed: 1,
        articlesRated: 0,
        articlesCategorized: 0,
        errors: 0,
        startTime: new Date(),
      });
      mockProcessorService.rateArticles.mockResolvedValueOnce({
        feedProfile: FeedProfile.TECHNOLOGY,
        articlesProcessed: 0,
        articlesRated: 1,
        articlesCategorized: 0,
        errors: 0,
        startTime: new Date(),
      });
      mockProcessorService.categorizeArticles.mockResolvedValueOnce({
        feedProfile: FeedProfile.TECHNOLOGY,
        articlesProcessed: 0,
        articlesRated: 0,
        articlesCategorized: 1,
        errors: 0,
        startTime: new Date(),
      });

      await processor.processMarkdownArticle(jobWithDifferentProfile);

      expect(mockProcessorService.processArticles).toHaveBeenCalledWith(
        FeedProfile.TECHNOLOGY,
        1,
        articleId,
      );
      expect(mockProcessorService.rateArticles).toHaveBeenCalledWith(
        FeedProfile.TECHNOLOGY,
        1,
        articleId,
      );
      expect(mockProcessorService.categorizeArticles).toHaveBeenCalledWith(
        FeedProfile.TECHNOLOGY,
        1,
        articleId,
      );
    });
  });

  describe('onModuleDestroy', () => {
    it('should close worker correctly', async () => {
      processor['worker'] = mockWorker;
      mockWorker.close.mockResolvedValueOnce();

      await processor.onModuleDestroy();

      expect(mockWorker.close).toHaveBeenCalledTimes(1);
    });

    it('should handle undefined worker gracefully', async () => {
      processor['worker'] = undefined as any;

      await expect(processor.onModuleDestroy()).resolves.not.toThrow();
    });
  });
});
