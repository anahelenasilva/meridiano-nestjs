import { ProcessMarkdownArticleJobData } from '@libs/queue';
import { RedisService } from '@libs/redis';
import { S3Service } from '@libs/s3';
import { Job, Worker } from 'bullmq';
import { mock } from 'jest-mock-extended';
import { ProcessorService } from '../../processor/processor.service';
import { FeedProfile } from '../../shared/types/feed';
import { DBArticle } from '../article.entity';
import { ArticleIngestionService } from '../ingestion/article-ingestion.service';
import { MarkdownArticleProcessor } from './markdown-article.processor';

jest.mock('bullmq');

const makeArticle = (overrides: Partial<DBArticle> = {}): DBArticle => ({
  id: 'article-123',
  url: 's3://test-bucket/test-file.md',
  title: 'Test Title',
  published_date: new Date(),
  feed_source: 'Unknown',
  raw_content: '# Test Title\n\nTest content.',
  feed_profile: FeedProfile.DEFAULT,
  created_at: new Date(),
  ...overrides,
});

describe('MarkdownArticleProcessor', () => {
  let processor: MarkdownArticleProcessor;
  const mockRedisService = mock<RedisService>();
  const mockS3Service = mock<S3Service>();
  const mockIngestionService = mock<ArticleIngestionService>();
  const mockProcessorService = mock<ProcessorService>();
  const mockWorker = mock<Worker>();

  beforeEach(() => {
    (Worker as unknown as jest.Mock).mockImplementation(() => mockWorker);

    processor = new MarkdownArticleProcessor(
      mockRedisService,
      mockS3Service,
      mockIngestionService,
      mockProcessorService,
    );
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
      expect(mockWorker.on).toHaveBeenCalledWith(
        'completed',
        expect.any(Function),
      );
      expect(mockWorker.on).toHaveBeenCalledWith(
        'failed',
        expect.any(Function),
      );
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

    it('should successfully process a markdown article', async () => {
      const markdownContent = '# Test Title\n\nTest content.';
      const article = makeArticle();

      mockS3Service.downloadMarkdownFile.mockResolvedValueOnce(markdownContent);
      mockIngestionService.ingest.mockResolvedValueOnce(article);
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
      expect(mockIngestionService.ingest).toHaveBeenCalledWith({
        url: 's3://test-bucket/test-file.md',
        title: 'Test Title',
        publishedDate: expect.any(Date),
        content: markdownContent,
        feedProfile: FeedProfile.DEFAULT,
        source: { type: 'markdown' },
        customPrompt: undefined,
      });
      expect(mockProcessorService.processArticles).toHaveBeenCalledWith(
        FeedProfile.DEFAULT,
        1,
        article.id,
        undefined,
      );
      expect(mockProcessorService.rateArticles).toHaveBeenCalledWith(
        FeedProfile.DEFAULT,
        1,
        article.id,
      );
      expect(mockProcessorService.categorizeArticles).toHaveBeenCalledWith(
        FeedProfile.DEFAULT,
        1,
        article.id,
      );
      expect(result).toEqual({
        success: true,
        message: expect.stringContaining('test-file.md'),
      });
    });

    it('should pass customPrompt to ingest', async () => {
      const markdownContent = '# My Article\n\nTest content.';
      const article = makeArticle({ id: 'article-456' });

      mockS3Service.downloadMarkdownFile.mockResolvedValueOnce(markdownContent);
      mockIngestionService.ingest.mockResolvedValueOnce(article);
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

      const jobWithPrompt = {
        ...mockJob,
        data: { ...mockJobData, customPrompt: 'focus on AI ethics' },
      } as Job<ProcessMarkdownArticleJobData>;

      await processor.processMarkdownArticle(jobWithPrompt);

      expect(mockIngestionService.ingest).toHaveBeenCalledWith(
        expect.objectContaining({ customPrompt: 'focus on AI ethics' }),
      );
    });

    it('should handle S3 download failure', async () => {
      const error = new Error('S3 download failed');
      mockS3Service.downloadMarkdownFile.mockRejectedValueOnce(error);

      await expect(processor.processMarkdownArticle(mockJob)).rejects.toThrow(
        'Markdown article processing failed for test-file.md',
      );

      expect(mockIngestionService.ingest).not.toHaveBeenCalled();
    });

    it('should handle markdown parsing failure', async () => {
      const markdownContent = 'No H1 heading here';
      mockS3Service.downloadMarkdownFile.mockResolvedValueOnce(markdownContent);

      await expect(processor.processMarkdownArticle(mockJob)).rejects.toThrow();

      expect(mockIngestionService.ingest).not.toHaveBeenCalled();
    });

    it('should handle ingestion failure', async () => {
      const markdownContent = '# Test Title\n\nTest content.';
      const error = new Error('Failed to persist article: s3://test-bucket/test-file.md');
      mockS3Service.downloadMarkdownFile.mockResolvedValueOnce(markdownContent);
      mockIngestionService.ingest.mockRejectedValueOnce(error);

      await expect(processor.processMarkdownArticle(mockJob)).rejects.toThrow(
        'Markdown article processing failed for test-file.md',
      );

      expect(mockProcessorService.processArticles).not.toHaveBeenCalled();
    });

    it('should handle processing failure', async () => {
      const markdownContent = '# Test Title\n\nTest content.';
      const article = makeArticle();
      mockS3Service.downloadMarkdownFile.mockResolvedValueOnce(markdownContent);
      mockIngestionService.ingest.mockResolvedValueOnce(article);
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
      const article = makeArticle();
      mockS3Service.downloadMarkdownFile.mockResolvedValueOnce(markdownContent);
      mockIngestionService.ingest.mockResolvedValueOnce(article);
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
      const article = makeArticle();
      mockS3Service.downloadMarkdownFile.mockResolvedValueOnce(markdownContent);
      mockIngestionService.ingest.mockResolvedValueOnce(article);
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
      const article = makeArticle({ id: 'article-456', feed_profile: FeedProfile.TECHNOLOGY });

      mockS3Service.downloadMarkdownFile.mockResolvedValueOnce(markdownContent);
      mockIngestionService.ingest.mockResolvedValueOnce(article);
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

      expect(mockIngestionService.ingest).toHaveBeenCalledWith(
        expect.objectContaining({ feedProfile: FeedProfile.TECHNOLOGY }),
      );
      expect(mockProcessorService.processArticles).toHaveBeenCalledWith(
        FeedProfile.TECHNOLOGY,
        1,
        article.id,
        undefined,
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
