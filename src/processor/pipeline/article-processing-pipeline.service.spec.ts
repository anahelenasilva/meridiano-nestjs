import { mock } from 'jest-mock-extended';
import { AiAdapter } from '../../ai/adapters/ai-adapter.interface';
import { ArticleCategory } from '../../articles/article.entity';
import { ArticlesService } from '../../articles/articles.service';
import { ConfigService } from '../../config/config.service';
import { ProfilesService } from '../../profiles/profiles.service';
import { ArticleProcessingPipelineService } from './article-processing-pipeline.service';
import { ProcessingNotifier } from './processing-notifier';
import { Sleeper } from './sleeper';
import { makeArticle } from './test-helpers';

describe('ArticleProcessingPipelineService', () => {
  const DELAY_MS = 500;

  let ai: jest.Mocked<AiAdapter>;
  let sleeper: jest.Mocked<Sleeper>;
  let notifier: jest.Mocked<ProcessingNotifier>;
  let articlesService: ReturnType<typeof mock<ArticlesService>>;
  let configService: ReturnType<typeof mock<ConfigService>>;
  let profilesService: ReturnType<typeof mock<ProfilesService>>;
  let service: ArticleProcessingPipelineService;

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
    profilesService = mock<ProfilesService>();

    configService.getArticleProcessingDelayMs.mockReturnValue(DELAY_MS);
    configService.getArticleSummaryPrompt.mockReturnValue('summary-prompt');
    configService.getImpactRatingPrompt.mockReturnValue('rating-prompt');
    configService.getCategoryClassificationPrompt.mockReturnValue('category-prompt');
    configService.isValidImpactRating.mockImplementation(
      (r: number): r is 1 => Number.isInteger(r) && r >= 1 && r <= 10,
    );
    // Empty profile prompts -> service falls back to ConfigService defaults.
    profilesService.getPromptsForProfile.mockReturnValue({});

    service = new ArticleProcessingPipelineService(
      ai,
      sleeper,
      notifier,
      articlesService,
      configService,
      profilesService,
    );
  });

  describe('happy path', () => {
    beforeEach(() => {
      ai.chat
        .mockResolvedValueOnce('This is the summary')
        .mockResolvedValueOnce('8')
        .mockResolvedValueOnce('["news","blog"]');
    });

    it('returns a result carrying summary, rating, and categories', async () => {
      const result = await service.processArticle(makeArticle());

      expect(result).toEqual({
        success: true,
        summary: 'This is the summary',
        rating: 8,
        categories: [ArticleCategory.NEWS, ArticleCategory.BLOG],
      });
      expect(notifier.notifyFailure).not.toHaveBeenCalled();
    });

    it('persists each step through ArticlesService', async () => {
      await service.processArticle(makeArticle({ id: 'article-1' }));

      expect(articlesService.updateArticleProcessing).toHaveBeenCalledWith(
        'article-1',
        expect.stringContaining('This is the summary'),
        [0.1, 0.2],
      );
      expect(articlesService.updateArticleRating).toHaveBeenCalledWith(
        'article-1',
        8,
      );
      expect(articlesService.updateArticleCategories).toHaveBeenCalledWith(
        'article-1',
        [ArticleCategory.NEWS, ArticleCategory.BLOG],
      );
    });

    it('sleeps the configured delay between AI calls', async () => {
      await service.processArticle(makeArticle());

      expect(sleeper.sleep).toHaveBeenCalledTimes(2);
      expect(sleeper.sleep).toHaveBeenNthCalledWith(1, DELAY_MS);
      expect(sleeper.sleep).toHaveBeenNthCalledWith(2, DELAY_MS);
    });
  });

  describe('partial failure (summarise succeeds, rate fails)', () => {
    beforeEach(() => {
      ai.chat
        .mockResolvedValueOnce('This is the summary')
        .mockResolvedValueOnce('not a number');
    });

    it('reflects the failure without discarding the summary', async () => {
      const result = await service.processArticle(makeArticle());

      expect(result.success).toBe(false);
      if (result.success) throw new Error('expected failure');
      expect(result.failedStep).toBe('rate');
      expect(result.summary).toBe('This is the summary');
      expect(result.rating).toBeUndefined();
    });

    it('still persisted the summary and never rated', async () => {
      await service.processArticle(makeArticle());

      expect(articlesService.updateArticleProcessing).toHaveBeenCalledTimes(1);
      expect(articlesService.updateArticleRating).not.toHaveBeenCalled();
      expect(articlesService.updateArticleCategories).not.toHaveBeenCalled();
    });
  });

  describe('failure notification', () => {
    it('notifies (email, via the injected notifier) when embedding fails', async () => {
      ai.chat.mockResolvedValueOnce('This is the summary');
      ai.embed.mockRejectedValueOnce(new Error('embedding provider down'));

      const result = await service.processArticle(makeArticle({ id: 'x' }));

      expect(notifier.notifyFailure).toHaveBeenCalledWith({
        article: expect.objectContaining({ id: 'x' }),
        step: 'summarise',
        error: 'embedding provider down',
      });
      // Failure result still carries the summary that was produced and persisted.
      expect(result.success).toBe(false);
      if (result.success) throw new Error('expected failure');
      expect(result.summary).toBe('This is the summary');
      expect(articlesService.updateArticleProcessing).toHaveBeenCalled();
    });

    it('notifies when the rate step fails', async () => {
      ai.chat
        .mockResolvedValueOnce('This is the summary')
        .mockResolvedValueOnce('99'); // out of range

      await service.processArticle(makeArticle());

      expect(notifier.notifyFailure).toHaveBeenCalledWith(
        expect.objectContaining({ step: 'rate' }),
      );
    });
  });

  describe('categorisation fallback', () => {
    it('falls back to OTHER when the category response is unparseable', async () => {
      ai.chat
        .mockResolvedValueOnce('This is the summary')
        .mockResolvedValueOnce('5')
        .mockResolvedValueOnce('not json');

      const result = await service.processArticle(makeArticle());

      expect(result.success).toBe(true);
      if (!result.success) throw new Error('expected success');
      expect(result.categories).toEqual([ArticleCategory.OTHER]);
      expect(notifier.notifyFailure).not.toHaveBeenCalled();
    });
  });

  describe('summarisation failure', () => {
    it('fails at summarise with no summary when the AI returns nothing', async () => {
      ai.chat.mockResolvedValueOnce('');

      const result = await service.processArticle(makeArticle());

      expect(result.success).toBe(false);
      if (result.success) throw new Error('expected failure');
      expect(result.failedStep).toBe('summarise');
      expect(result.summary).toBeUndefined();
      expect(articlesService.updateArticleProcessing).not.toHaveBeenCalled();
      expect(notifier.notifyFailure).toHaveBeenCalledWith(
        expect.objectContaining({ step: 'summarise' }),
      );
    });
  });
});
