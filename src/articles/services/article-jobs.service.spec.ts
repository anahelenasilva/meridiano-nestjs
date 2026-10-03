import { PROCESS_ARTICLE_JOB, PROCESS_MARKDOWN_ARTICLE_JOB } from '@libs/queue';
import { Job, Queue } from 'bullmq';
import { mock } from 'jest-mock-extended';
import { FeedProfile } from '../../shared/types/feed';
import { ArticleJobsService } from './article-jobs.service';

describe('ArticleJobsService', () => {
  const articleQueue = mock<Queue>();
  const markdownQueue = mock<Queue>();
  let service: ArticleJobsService;

  beforeEach(() => {
    jest.clearAllMocks();
    articleQueue.add.mockResolvedValue({ id: 'job-1' } as Job);
    markdownQueue.add.mockResolvedValue({ id: 'job-1' } as Job);
    service = new ArticleJobsService(articleQueue, markdownQueue);
  });

  it('enqueues an article processing job and returns its job info', async () => {
    const result = await service.addArticleProcessingJob(
      'article-1',
      FeedProfile.TECHNOLOGY,
      true,
    );

    expect(articleQueue.add).toHaveBeenCalledWith(PROCESS_ARTICLE_JOB, {
      articleFileKey: 'article-1',
      feedProfile: FeedProfile.TECHNOLOGY,
      generateAudio: true,
    });
    expect(result).toEqual({
      success: true,
      articleFileKey: 'article-1',
      jobId: 'job-1',
      message: 'Article queued for processing',
    });
  });

  it('enqueues a markdown job without per-job retry options', async () => {
    const result = await service.addMarkdownArticleProcessingJob(
      'bucket',
      'key.md',
      FeedProfile.DEFAULT,
      'prompt',
      false,
    );

    expect(markdownQueue.add).toHaveBeenCalledWith(
      PROCESS_MARKDOWN_ARTICLE_JOB,
      {
        s3Bucket: 'bucket',
        s3Key: 'key.md',
        feedProfile: FeedProfile.DEFAULT,
        customPrompt: 'prompt',
        generateAudio: false,
      },
    );
    expect(result).toEqual({
      success: true,
      articleFileKey: 'key.md',
      jobId: 'job-1',
      message: 'Markdown article queued for processing',
    });
  });
});
