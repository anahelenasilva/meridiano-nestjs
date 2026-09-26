import { AudioJobService } from '@libs/audio';
import { ProcessMarkdownArticleJobData } from '@libs/queue';
import { RedisService } from '@libs/redis';
import { S3Service } from '@libs/s3';
import { Job, Worker } from 'bullmq';
import { mock } from 'jest-mock-extended';
import { ArticleProcessingPipelineService } from '../../processor/pipeline/article-processing-pipeline.service';
import { makeArticle } from '../../processor/pipeline/test-helpers';
import { ProcessingSuccess } from '../../processor/pipeline/processing-result';
import { FeedProfile } from '../../shared/types/feed';
import { ArticleIngestionService } from '../ingestion/article-ingestion.service';
import { MarkdownArticleProcessor } from './markdown-article.processor';

jest.mock('bullmq');

const markdownContent = '# Test Title\n\nTest content.';

const processed: ProcessingSuccess = {
  success: true,
  summary: 'the summary',
  rating: 7,
  categories: [],
};

describe('MarkdownArticleProcessor', () => {
  let processor: MarkdownArticleProcessor;
  const mockRedisService = mock<RedisService>();
  const mockS3Service = mock<S3Service>();
  const mockIngestionService = mock<ArticleIngestionService>();
  const pipeline = mock<ArticleProcessingPipelineService>();
  const audioJobService = mock<AudioJobService>();
  const mockWorker = mock<Worker>();

  const createJob = (
    overrides: Partial<ProcessMarkdownArticleJobData> = {},
  ): Job<ProcessMarkdownArticleJobData> =>
    ({
      id: 'test-job-id',
      data: {
        s3Bucket: 'test-bucket',
        s3Key: 'test-file.md',
        feedProfile: FeedProfile.DEFAULT,
        ...overrides,
      },
    }) as Job<ProcessMarkdownArticleJobData>;

  beforeEach(() => {
    (Worker as unknown as jest.Mock).mockImplementation(() => mockWorker);

    processor = new MarkdownArticleProcessor(
      mockRedisService,
      mockS3Service,
      mockIngestionService,
      pipeline,
      audioJobService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
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
    it('ingests the parsed markdown and runs the saved article through the pipeline', async () => {
      const article = makeArticle({ id: 'article-123' });
      mockS3Service.downloadMarkdownFile.mockResolvedValueOnce(markdownContent);
      mockIngestionService.ingest.mockResolvedValueOnce(article);
      pipeline.processArticle.mockResolvedValueOnce(processed);

      const result = await processor.processMarkdownArticle(createJob());

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
      expect(pipeline.processArticle).toHaveBeenCalledWith(article);
      expect(result).toEqual({
        success: true,
        message: expect.stringContaining('article-123'),
      });
    });

    it('passes the job feed profile and custom prompt to ingest', async () => {
      mockS3Service.downloadMarkdownFile.mockResolvedValueOnce(markdownContent);
      mockIngestionService.ingest.mockResolvedValueOnce(makeArticle());
      pipeline.processArticle.mockResolvedValueOnce(processed);

      await processor.processMarkdownArticle(
        createJob({
          feedProfile: FeedProfile.TECHNOLOGY,
          customPrompt: 'focus on AI ethics',
        }),
      );

      expect(mockIngestionService.ingest).toHaveBeenCalledWith(
        expect.objectContaining({
          feedProfile: FeedProfile.TECHNOLOGY,
          customPrompt: 'focus on AI ethics',
        }),
      );
    });

    it('fails the job with the failed step when the pipeline fails', async () => {
      mockS3Service.downloadMarkdownFile.mockResolvedValueOnce(markdownContent);
      mockIngestionService.ingest.mockResolvedValueOnce(makeArticle());
      pipeline.processArticle.mockResolvedValueOnce({
        success: false,
        failedStep: 'rate',
        error: 'bad rating',
        summary: 'the summary',
      });

      await expect(
        processor.processMarkdownArticle(createJob({ generateAudio: true })),
      ).rejects.toThrow(/test-file\.md.*at rate step: bad rating/);

      expect(audioJobService.enqueueAudioJob).not.toHaveBeenCalled();
    });

    it('enqueues audio from the pipeline summary when asked', async () => {
      mockS3Service.downloadMarkdownFile.mockResolvedValueOnce(markdownContent);
      mockIngestionService.ingest.mockResolvedValueOnce(
        makeArticle({ id: 'article-123' }),
      );
      pipeline.processArticle.mockResolvedValueOnce(processed);
      audioJobService.enqueueAudioJob.mockResolvedValueOnce({
        jobId: 'audio-1',
      } as never);

      await processor.processMarkdownArticle(
        createJob({ generateAudio: true }),
      );

      expect(audioJobService.enqueueAudioJob).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceType: 'article',
          sourceId: 'article-123',
          text: 'the summary',
        }),
      );
    });

    it('does not enqueue audio unless asked', async () => {
      mockS3Service.downloadMarkdownFile.mockResolvedValueOnce(markdownContent);
      mockIngestionService.ingest.mockResolvedValueOnce(makeArticle());
      pipeline.processArticle.mockResolvedValueOnce(processed);

      await processor.processMarkdownArticle(createJob());

      expect(audioJobService.enqueueAudioJob).not.toHaveBeenCalled();
    });

    it('does not fail the job when audio enqueue throws', async () => {
      mockS3Service.downloadMarkdownFile.mockResolvedValueOnce(markdownContent);
      mockIngestionService.ingest.mockResolvedValueOnce(makeArticle());
      pipeline.processArticle.mockResolvedValueOnce(processed);
      audioJobService.enqueueAudioJob.mockRejectedValueOnce(
        new Error('queue down'),
      );

      const result = await processor.processMarkdownArticle(
        createJob({ generateAudio: true }),
      );

      expect(result.success).toBe(true);
    });

    it('fails the job without ingesting when the S3 download fails', async () => {
      mockS3Service.downloadMarkdownFile.mockRejectedValueOnce(
        new Error('S3 download failed'),
      );

      await expect(
        processor.processMarkdownArticle(createJob()),
      ).rejects.toThrow('Markdown article processing failed for test-file.md');

      expect(mockIngestionService.ingest).not.toHaveBeenCalled();
    });

    it('fails the job without ingesting when the markdown has no title', async () => {
      mockS3Service.downloadMarkdownFile.mockResolvedValueOnce(
        'No H1 heading here',
      );

      await expect(
        processor.processMarkdownArticle(createJob()),
      ).rejects.toThrow();

      expect(mockIngestionService.ingest).not.toHaveBeenCalled();
    });

    it('fails the job without processing when ingestion fails', async () => {
      mockS3Service.downloadMarkdownFile.mockResolvedValueOnce(markdownContent);
      mockIngestionService.ingest.mockRejectedValueOnce(
        new Error('Failed to persist article'),
      );

      await expect(
        processor.processMarkdownArticle(createJob()),
      ).rejects.toThrow('Markdown article processing failed for test-file.md');

      expect(pipeline.processArticle).not.toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy', () => {
    it('should close worker correctly', async () => {
      processor['worker'] = mockWorker;
      mockWorker.close.mockResolvedValueOnce();

      await processor.onModuleDestroy();

      expect(mockWorker.close).toHaveBeenCalledTimes(1);
    });
  });
});
