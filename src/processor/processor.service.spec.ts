import { AudioJobService } from '@libs/audio';
import { mock } from 'jest-mock-extended';
import { AiAdapter } from '../ai/adapters/ai-adapter.interface';
import { ArticleCategory } from '../articles/article.entity';
import { ArticlesService } from '../articles/articles.service';
import { ConfigService } from '../config/config.service';
import { ProfilesService } from '../profiles/profiles.service';
import { FeedProfile } from '../shared/types/feed';
import { ArticleProcessingPipelineService } from './pipeline/article-processing-pipeline.service';
import { ProcessingNotifier } from './pipeline/processing-notifier';
import { Sleeper } from './pipeline/sleeper';
import { makeArticle } from './pipeline/test-helpers';
import { ProcessorService } from './processor.service';

describe('ProcessorService', () => {
  const DELAY_MS = 500;

  let ai: jest.Mocked<AiAdapter>;
  let sleeper: jest.Mocked<Sleeper>;
  let notifier: jest.Mocked<ProcessingNotifier>;
  let articlesService: ReturnType<typeof mock<ArticlesService>>;
  let configService: ReturnType<typeof mock<ConfigService>>;
  let audioJobService: ReturnType<typeof mock<AudioJobService>>;
  let service: ProcessorService;

  beforeEach(() => {
    ai = {
      chat: jest.fn(),
      embed: jest.fn().mockResolvedValue([0.1, 0.2]),
      generateAudio: jest.fn(),
    } as jest.Mocked<AiAdapter>;
    sleeper = { sleep: jest.fn().mockResolvedValue(undefined) };
    notifier = { notifyFailure: jest.fn().mockResolvedValue(undefined) };

    articlesService = mock<ArticlesService>();
    configService = mock<ConfigService>();
    audioJobService = mock<AudioJobService>();
    const profilesService = mock<ProfilesService>();

    configService.getArticleProcessingDelayMs.mockReturnValue(DELAY_MS);
    configService.getArticleSummaryPrompt.mockReturnValue('summary-prompt');
    configService.getImpactRatingPrompt.mockReturnValue('rating-prompt');
    configService.getCategoryClassificationPrompt.mockReturnValue(
      'category-prompt',
    );
    configService.isValidImpactRating.mockImplementation(
      (r: number): r is 1 => Number.isInteger(r) && r >= 1 && r <= 10,
    );
    profilesService.getPromptsForProfile.mockReturnValue({});

    const pipeline = new ArticleProcessingPipelineService(
      ai,
      sleeper,
      notifier,
      articlesService,
      configService,
      profilesService,
    );
    service = new ProcessorService(
      articlesService,
      pipeline,
      sleeper,
      configService,
      audioJobService,
    );
  });

  describe('processArticles', () => {
    it('alerts once per article whose embedding fails, and counts it as failed', async () => {
      articlesService.getUnprocessedArticles.mockResolvedValue([
        makeArticle({ id: 'throws' }),
        makeArticle({ id: 'ok' }),
        makeArticle({ id: 'null' }),
      ]);
      ai.chat.mockResolvedValue('A summary');
      ai.embed
        .mockRejectedValueOnce(new Error('provider down'))
        .mockResolvedValueOnce([0.1])
        .mockResolvedValueOnce(null as unknown as number[]);

      const stats = await service.processArticles(FeedProfile.DEFAULT);

      expect(stats).toMatchObject({ articlesProcessed: 1, errors: 2 });
      expect(notifier.notifyFailure).toHaveBeenCalledTimes(2);
      expect(notifier.notifyFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          article: expect.objectContaining({ id: 'throws' }),
          step: 'summarise',
        }),
      );
      expect(notifier.notifyFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          article: expect.objectContaining({ id: 'null' }),
          step: 'summarise',
        }),
      );
      // The summary is still saved when only the embedding fails.
      expect(articlesService.updateArticleProcessing).toHaveBeenCalledTimes(3);
    });

    it('only summarises, leaving rating and categorisation to their own stages', async () => {
      articlesService.getUnprocessedArticles.mockResolvedValue([makeArticle()]);
      ai.chat.mockResolvedValue('A summary');

      await service.processArticles(FeedProfile.DEFAULT);

      expect(ai.chat).toHaveBeenCalledTimes(1);
      expect(articlesService.updateArticleRating).not.toHaveBeenCalled();
      expect(articlesService.updateArticleCategories).not.toHaveBeenCalled();
    });

    it('sleeps the configured delay after each article', async () => {
      articlesService.getUnprocessedArticles.mockResolvedValue([
        makeArticle({ id: 'a' }),
        makeArticle({ id: 'b' }),
      ]);
      ai.chat.mockResolvedValue('A summary');

      await service.processArticles(FeedProfile.DEFAULT);

      expect(sleeper.sleep).toHaveBeenCalledTimes(2);
      expect(sleeper.sleep).toHaveBeenCalledWith(DELAY_MS);
    });

    it('enqueues audio from the summary when asked', async () => {
      articlesService.getUnprocessedArticles.mockResolvedValue([
        makeArticle({ id: 'a' }),
      ]);
      ai.chat.mockResolvedValue('A summary');
      audioJobService.enqueueAudioJob.mockResolvedValue({
        jobId: 'job-1',
      } as never);

      await service.processArticles(FeedProfile.DEFAULT, 1000, undefined, true);

      expect(audioJobService.enqueueAudioJob).toHaveBeenCalledWith(
        expect.objectContaining({ sourceId: 'a', text: 'A summary' }),
      );
    });

    it('processes only the given article when an id is passed', async () => {
      articlesService.getUnprocessedArticleById.mockResolvedValue(
        makeArticle({ id: 'x' }),
      );
      ai.chat.mockResolvedValue('A summary');

      const stats = await service.processArticles(FeedProfile.DEFAULT, 1, 'x');

      expect(articlesService.getUnprocessedArticles).not.toHaveBeenCalled();
      expect(stats.articlesProcessed).toBe(1);
    });
  });

  describe('rateArticles', () => {
    it('rates summarised articles, skips unsummarised ones, and counts failures', async () => {
      articlesService.getUnratedArticles.mockResolvedValue([
        makeArticle({ id: 'good', processed_content: 'summary' }),
        makeArticle({ id: 'no-summary' }),
        makeArticle({ id: 'bad', processed_content: 'summary' }),
      ]);
      ai.chat.mockResolvedValueOnce('7').mockResolvedValueOnce('99');

      const stats = await service.rateArticles(FeedProfile.DEFAULT);

      expect(stats).toMatchObject({ articlesRated: 1, errors: 1 });
      expect(articlesService.updateArticleRating).toHaveBeenCalledWith(
        'good',
        7,
      );
      expect(notifier.notifyFailure).toHaveBeenCalledTimes(1);
      expect(notifier.notifyFailure).toHaveBeenCalledWith(
        expect.objectContaining({ step: 'rate' }),
      );
    });
  });

  describe('categorizeArticles', () => {
    it('categorises summarised articles and skips unsummarised ones', async () => {
      articlesService.getUncategorizedArticles.mockResolvedValue([
        makeArticle({ id: 'good', processed_content: 'summary' }),
        makeArticle({ id: 'no-summary' }),
      ]);
      ai.chat.mockResolvedValueOnce('["news"]');

      const stats = await service.categorizeArticles(FeedProfile.DEFAULT);

      expect(stats).toMatchObject({ articlesCategorized: 1, errors: 0 });
      expect(articlesService.updateArticleCategories).toHaveBeenCalledWith(
        'good',
        [ArticleCategory.NEWS],
      );
    });
  });
});
