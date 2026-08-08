import { AudioJobService } from '@libs/audio';
import { ProcessArticleJobData } from '@libs/queue';
import { Job } from 'bullmq';
import { mock } from 'jest-mock-extended';
import { ArticlesService } from '../../articles/articles.service';
import { makeArticle } from '../pipeline/test-helpers';
import { ArticleProcessingPipelineService } from '../pipeline/article-processing-pipeline.service';
import { ArticleProcessor } from './article.processor';

describe('ArticleProcessor', () => {
  let processor: ArticleProcessor;
  let pipeline: ReturnType<typeof mock<ArticleProcessingPipelineService>>;
  let articlesService: ReturnType<typeof mock<ArticlesService>>;
  let audioJobService: ReturnType<typeof mock<AudioJobService>>;

  const createJob = (
    overrides?: Partial<ProcessArticleJobData>,
  ): Job<ProcessArticleJobData> =>
    ({
      id: 'job-1',
      data: {
        articleFileKey: 'article-1',
        feedProfile: 'general',
        generateAudio: false,
        ...overrides,
      },
    }) as Job<ProcessArticleJobData>;

  beforeEach(() => {
    pipeline = mock<ArticleProcessingPipelineService>();
    articlesService = mock<ArticlesService>();
    audioJobService = mock<AudioJobService>();

    processor = new ArticleProcessor(
      { getClient: () => ({}) } as never,
      pipeline,
      articlesService,
      audioJobService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('throws when the article is not found (already processed)', async () => {
    articlesService.getUnprocessedArticleById.mockResolvedValue(null);

    await expect(processor.handleJob(createJob())).rejects.toThrow(
      /article-1 not found or already processed/,
    );
    expect(pipeline.processArticle).not.toHaveBeenCalled();
  });

  it('runs the pipeline and acks on success', async () => {
    articlesService.getUnprocessedArticleById.mockResolvedValue(
      makeArticle({ id: 'article-1' }),
    );
    pipeline.processArticle.mockResolvedValue({
      success: true,
      summary: 'the summary',
      rating: 7,
      categories: [],
    } as never);

    const result = await processor.handleJob(createJob());

    expect(pipeline.processArticle).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'article-1' }),
    );
    expect(result.success).toBe(true);
  });

  it('throws (fails the job) when the pipeline returns a failure', async () => {
    articlesService.getUnprocessedArticleById.mockResolvedValue(makeArticle());
    pipeline.processArticle.mockResolvedValue({
      success: false,
      failedStep: 'rate',
      error: 'bad rating',
    } as never);

    await expect(processor.handleJob(createJob())).rejects.toThrow(
      /at rate step: bad rating/,
    );
    expect(audioJobService.enqueueAudioJob).not.toHaveBeenCalled();
  });

  it('does not enqueue audio when generateAudio is false', async () => {
    articlesService.getUnprocessedArticleById.mockResolvedValue(makeArticle());
    pipeline.processArticle.mockResolvedValue({
      success: true,
      summary: 's',
      rating: 5,
      categories: [],
    } as never);

    await processor.handleJob(createJob({ generateAudio: false }));

    expect(audioJobService.enqueueAudioJob).not.toHaveBeenCalled();
  });

  it('enqueues audio with the pipeline summary when generateAudio is true', async () => {
    articlesService.getUnprocessedArticleById.mockResolvedValue(
      makeArticle({ id: 'article-1', published_date: new Date('2026-02-02') }),
    );
    pipeline.processArticle.mockResolvedValue({
      success: true,
      summary: 'audio summary text',
      rating: 5,
      categories: [],
    } as never);
    audioJobService.enqueueAudioJob.mockResolvedValue({
      jobId: 'audio-1',
      status: 'queued',
    } as never);

    await processor.handleJob(createJob({ generateAudio: true }));

    expect(audioJobService.enqueueAudioJob).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: 'article',
        sourceId: 'article-1',
        text: 'audio summary text',
      }),
    );
  });

  it('does not fail the job when audio enqueue throws (best-effort)', async () => {
    articlesService.getUnprocessedArticleById.mockResolvedValue(makeArticle());
    pipeline.processArticle.mockResolvedValue({
      success: true,
      summary: 's',
      rating: 5,
      categories: [],
    } as never);
    audioJobService.enqueueAudioJob.mockRejectedValue(new Error('queue down'));

    const result = await processor.handleJob(createJob({ generateAudio: true }));

    expect(result.success).toBe(true);
  });
});
