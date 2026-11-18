import { Effect, Either } from 'effect';
import { mock } from 'jest-mock-extended';
import { AiAdapter } from '../../ai/adapters/ai-adapter.interface';
import { ArticleCategory } from '../../articles/article.entity';
import { ArticlesService } from '../../articles/articles.service';
import { ConfigService } from '../../config/config.service';
import { ProfilesService } from '../../profiles/profiles.service';
import { ArticleProcessingPipelineService } from './article-processing-pipeline.service';
import { ProcessingNotifier } from './processing-notifier';
import { makeArticle } from '../../articles/test-helpers';

describe('ArticleProcessingPipelineService', () => {
  const DELAY_MS = 500;

  let ai: jest.Mocked<AiAdapter>;
  let notifier: jest.Mocked<ProcessingNotifier>;
  let articlesService: ReturnType<typeof mock<ArticlesService>>;
  let configService: ReturnType<typeof mock<ConfigService>>;
  let profilesService: ReturnType<typeof mock<ProfilesService>>;
  let service: ArticleProcessingPipelineService;

  // Fake timers carry Effect.sleep's waits between steps, so a run passes in
  // no real time.
  async function run<A, E>(
    effect: Effect.Effect<A, E>,
  ): Promise<Either.Either<A, E>> {
    const result = Effect.runPromise(Effect.either(effect));
    await jest.advanceTimersByTimeAsync(2 * DELAY_MS);
    return result;
  }

  async function runFailure<A, E>(effect: Effect.Effect<A, E>): Promise<E> {
    const result = await run(effect);
    if (Either.isRight(result)) throw new Error('expected failure');
    return result.left;
  }

  beforeEach(() => {
    jest.useFakeTimers();

    ai = {
      chat: jest.fn(),
      embed: jest.fn().mockResolvedValue([0.1, 0.2]),
      generateAudio: jest.fn(),
    } as jest.Mocked<AiAdapter>;

    notifier = { notifyFailure: jest.fn().mockResolvedValue(undefined) };

    articlesService = mock<ArticlesService>();
    configService = mock<ConfigService>();
    profilesService = mock<ProfilesService>();

    articlesService.updateArticleProcessing.mockResolvedValue(undefined);
    articlesService.updateArticleRating.mockResolvedValue(undefined);
    articlesService.updateArticleCategories.mockResolvedValue(undefined);
    configService.getArticleProcessingDelayMs.mockReturnValue(DELAY_MS);
    configService.getArticleSummaryPrompt.mockReturnValue('summary-prompt');
    configService.getImpactRatingPrompt.mockReturnValue('rating-prompt');
    configService.getCategoryClassificationPrompt.mockReturnValue(
      'category-prompt',
    );
    configService.isValidImpactRating.mockImplementation(
      (r: number): r is 1 => Number.isInteger(r) && r >= 1 && r <= 10,
    );
    // Empty profile prompts -> service falls back to ConfigService defaults.
    profilesService.getPromptsForProfile.mockReturnValue({});

    service = new ArticleProcessingPipelineService(
      ai,
      notifier,
      articlesService,
      configService,
      profilesService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('happy path', () => {
    beforeEach(() => {
      ai.chat
        .mockResolvedValueOnce('This is the summary')
        .mockResolvedValueOnce('8')
        .mockResolvedValueOnce('["news","blog"]');
    });

    it('succeeds with the summary, rating, and categories', async () => {
      const result = await run(service.processArticle(makeArticle()));

      expect(result).toEqual(
        Either.right({
          summary: 'This is the summary',
          rating: 8,
          categories: [ArticleCategory.NEWS, ArticleCategory.BLOG],
        }),
      );
      expect(notifier.notifyFailure).not.toHaveBeenCalled();
    });

    it('persists each step through ArticlesService', async () => {
      await run(service.processArticle(makeArticle({ id: 'article-1' })));

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

    it('waits the configured delay before the rate and categorise calls', async () => {
      const done = Effect.runPromise(service.processArticle(makeArticle()));

      await jest.advanceTimersByTimeAsync(DELAY_MS - 1);
      expect(ai.chat).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(1);
      expect(ai.chat).toHaveBeenCalledTimes(2);
      await jest.advanceTimersByTimeAsync(DELAY_MS - 1);
      expect(ai.chat).toHaveBeenCalledTimes(2);
      await jest.advanceTimersByTimeAsync(1);
      expect(ai.chat).toHaveBeenCalledTimes(3);
      await done;
    });
  });

  describe('partial failure (summarise succeeds, rate fails)', () => {
    beforeEach(() => {
      ai.chat
        .mockResolvedValueOnce('This is the summary')
        .mockResolvedValueOnce('not a number');
    });

    it('fails at rate and keeps the summary', async () => {
      const failure = await runFailure(service.processArticle(makeArticle()));

      expect(failure).toMatchObject({
        step: 'rate',
        reason: { _tag: 'RatingUnparseable' },
        summary: 'This is the summary',
      });
      expect(failure.rating).toBeUndefined();
    });

    it('still persisted the summary and never rated', async () => {
      await run(service.processArticle(makeArticle()));

      expect(articlesService.updateArticleProcessing).toHaveBeenCalledTimes(1);
      expect(articlesService.updateArticleRating).not.toHaveBeenCalled();
      expect(articlesService.updateArticleCategories).not.toHaveBeenCalled();
    });
  });

  it('keeps the summary and rating when categorise fails', async () => {
    ai.chat
      .mockResolvedValueOnce('This is the summary')
      .mockResolvedValueOnce('8')
      .mockResolvedValueOnce('["news"]');
    articlesService.updateArticleCategories.mockRejectedValueOnce(
      new Error('db down'),
    );

    const failure = await runFailure(
      service.processArticle(makeArticle({ id: 'x' })),
    );

    expect(failure).toMatchObject({
      step: 'categorise',
      reason: { _tag: 'SaveFailed' },
      summary: 'This is the summary',
      rating: 8,
    });
    expect(failure.message).toBe(
      'Failed to process article x at categorise step: db down',
    );
  });

  describe('failure notification', () => {
    it('notifies when embedding fails, after saving the summary', async () => {
      ai.chat.mockResolvedValueOnce('This is the summary');
      ai.embed.mockRejectedValueOnce(new Error('embedding provider down'));

      const failure = await runFailure(
        service.processArticle(makeArticle({ id: 'x' })),
      );

      expect(notifier.notifyFailure).toHaveBeenCalledTimes(1);
      expect(notifier.notifyFailure).toHaveBeenCalledWith({
        article: expect.objectContaining({ id: 'x' }),
        step: 'summarise',
        error: 'embedding provider down',
      });
      expect(failure).toMatchObject({
        step: 'summarise',
        reason: { _tag: 'EmbeddingFailed' },
        summary: 'This is the summary',
      });
      expect(articlesService.updateArticleProcessing).toHaveBeenCalledWith(
        'x',
        expect.stringContaining('This is the summary'),
        null,
      );
    });

    it('notifies once when the rating is out of range', async () => {
      ai.chat
        .mockResolvedValueOnce('This is the summary')
        .mockResolvedValueOnce('99');

      const failure = await runFailure(
        service.processArticle(makeArticle({ id: 'x' })),
      );

      expect(failure.reason._tag).toBe('RatingOutOfRange');
      expect(notifier.notifyFailure).toHaveBeenCalledTimes(1);
      expect(notifier.notifyFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          step: 'rate',
          error: 'Rating 99 for article x is out of range (1-10)',
        }),
      );
    });

    it('notifies with the provider message when the AI call rejects', async () => {
      ai.chat.mockRejectedValueOnce(new Error('provider exploded'));

      const failure = await runFailure(service.processArticle(makeArticle()));

      expect(failure.reason._tag).toBe('AiCallFailed');
      expect(notifier.notifyFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          step: 'summarise',
          error: 'provider exploded',
        }),
      );
    });
  });

  describe('categorisation fallback', () => {
    it('falls back to OTHER when the category response is unparseable', async () => {
      ai.chat
        .mockResolvedValueOnce('This is the summary')
        .mockResolvedValueOnce('5')
        .mockResolvedValueOnce('not json');

      const result = await run(service.processArticle(makeArticle()));

      expect(result).toEqual(
        Either.right(
          expect.objectContaining({ categories: [ArticleCategory.OTHER] }),
        ),
      );
      expect(notifier.notifyFailure).not.toHaveBeenCalled();
    });

    it('falls back to OTHER when the category call rejects', async () => {
      ai.chat.mockRejectedValueOnce(new Error('provider down'));

      const result = await run(
        service.categoriseArticle(makeArticle(), 'saved summary'),
      );

      expect(result).toEqual(Either.right([ArticleCategory.OTHER]));
      expect(notifier.notifyFailure).not.toHaveBeenCalled();
    });
  });

  describe('step entry points', () => {
    it('rateArticle rates the given summary on its own', async () => {
      ai.chat.mockResolvedValueOnce('6');

      const result = await run(
        service.rateArticle(makeArticle({ id: 'a' }), 'saved summary'),
      );

      expect(result).toEqual(Either.right(6));
      expect(configService.getImpactRatingPrompt).toHaveBeenCalledWith(
        'saved summary',
      );
      expect(articlesService.updateArticleRating).toHaveBeenCalledWith('a', 6);
    });

    it('categoriseArticle fails with SaveFailed when persisting categories fails', async () => {
      ai.chat.mockResolvedValueOnce('["news"]');
      articlesService.updateArticleCategories.mockRejectedValueOnce(
        new Error('db down'),
      );

      const failure = await runFailure(
        service.categoriseArticle(makeArticle(), 'saved summary'),
      );

      expect(failure).toMatchObject({ _tag: 'SaveFailed', message: 'db down' });
      expect(notifier.notifyFailure).toHaveBeenCalledTimes(1);
      expect(notifier.notifyFailure).toHaveBeenCalledWith(
        expect.objectContaining({ step: 'categorise', error: 'db down' }),
      );
    });

    it('reports a persistence error at the step that hit it', async () => {
      ai.chat.mockResolvedValueOnce('6');
      articlesService.updateArticleRating.mockRejectedValueOnce(
        new Error('db down'),
      );

      const failure = await runFailure(
        service.rateArticle(makeArticle(), 'saved summary'),
      );

      expect(failure._tag).toBe('SaveFailed');
      expect(notifier.notifyFailure).toHaveBeenCalledTimes(1);
      expect(notifier.notifyFailure).toHaveBeenCalledWith(
        expect.objectContaining({ step: 'rate', error: 'db down' }),
      );
    });
  });

  describe('summary prompt', () => {
    it.each([
      [{ title: 'Title', feed_source: 'Feed' }, 'Title'],
      [{ title: '', feed_source: 'Feed' }, 'Feed'],
      [{ title: '', feed_source: '' }, 'Untitled'],
    ])('fills article_title from %o as %s', async (overrides, expected) => {
      profilesService.getPromptsForProfile.mockReturnValue({
        articleSummary: '{article_title}: {article_content}',
      });
      ai.chat.mockResolvedValueOnce('This is the summary');

      await run(service.summariseArticle(makeArticle(overrides)));

      expect(configService.formatPrompt).toHaveBeenCalledWith(
        '{article_title}: {article_content}',
        { article_content: 'raw content body', article_title: expected },
      );
    });
  });

  describe('summarisation failure', () => {
    it('fails at summarise with no summary when the AI returns nothing', async () => {
      ai.chat.mockResolvedValueOnce('');

      const failure = await runFailure(service.processArticle(makeArticle()));

      expect(failure).toMatchObject({
        step: 'summarise',
        reason: { _tag: 'SummaryEmpty' },
      });
      expect(failure.summary).toBeUndefined();
      expect(articlesService.updateArticleProcessing).not.toHaveBeenCalled();
      expect(notifier.notifyFailure).toHaveBeenCalledWith(
        expect.objectContaining({ step: 'summarise' }),
      );
    });
  });
});
