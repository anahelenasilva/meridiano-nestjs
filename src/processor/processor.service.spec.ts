import { AudioJobService } from '@libs/audio';
import { EmailService } from '@libs/email';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { AiService } from '../ai/ai.service';
import { DBArticle } from '../articles/article.entity';
import { ArticlesService } from '../articles/articles.service';
import { ConfigService } from '../config/config.service';
import { ProfilesService } from '../profiles/profiles.service';
import { FeedProfile } from '../shared/types/feed';
import { ProcessorService } from './processor.service';

describe('ProcessorService', () => {
  let service: ProcessorService;
  const mockArticlesService = mock<ArticlesService>();
  const mockAiService = mock<AiService>();
  const mockConfigService = mock<ConfigService>();
  const mockProfilesService = mock<ProfilesService>();
  const mockAudioJobService = mock<AudioJobService>();
  const mockEmailService = mock<EmailService>();

  const mockArticle: DBArticle = {
    id: 'article-1',
    url: 'https://example.com/article',
    title: 'Test Article',
    published_date: new Date('2024-01-01'),
    feed_source: 'test-feed',
    raw_content: 'Test content',
    feed_profile: FeedProfile.DEFAULT,
    created_at: new Date('2024-01-01'),
  };

  beforeEach(async () => {

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: ProcessorService,
          useFactory: () =>
            new ProcessorService(
              mockArticlesService,
              mockAiService,
              mockConfigService,
              mockProfilesService,
              mockAudioJobService,
              mockEmailService,
            ),
        },
      ],
    }).compile();

    service = module.get<ProcessorService>(ProcessorService);

    mockProfilesService.getPromptsForProfile.mockReturnValue({
      articleSummary: undefined,
      impactRating: undefined,
    });
    mockConfigService.formatPrompt.mockImplementation((template) => template);
    mockConfigService.getArticleSummaryPrompt.mockReturnValue('summary prompt');
    mockArticlesService.getUnprocessedArticles.mockResolvedValue([mockArticle]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processArticles - article_title placeholder', () => {
    it('passes article title to formatPrompt when profile has articleSummary', async () => {
      mockProfilesService.getPromptsForProfile.mockReturnValue({
        articleSummary: 'Summarize {article_title}: {article_content}',
        impactRating: undefined,
      });
      mockConfigService.formatPrompt.mockReturnValue('formatted prompt');
      mockAiService.callChat.mockResolvedValue('Article summary');
      mockAiService.getEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);

      await service.processArticles(FeedProfile.DEFAULT, 10);

      expect(mockConfigService.formatPrompt).toHaveBeenCalledWith(
        'Summarize {article_title}: {article_content}',
        {
          article_content: 'Test content',
          article_title: 'Test Article',
        },
      );
    });

    it('uses feed_source as fallback when article title is empty', async () => {
      const articleNoTitle: DBArticle = {
        ...mockArticle,
        title: '',
        feed_source: 'test-feed',
      };
      mockArticlesService.getUnprocessedArticles.mockResolvedValue([articleNoTitle]);
      mockProfilesService.getPromptsForProfile.mockReturnValue({
        articleSummary: '{article_title}: {article_content}',
        impactRating: undefined,
      });
      mockConfigService.formatPrompt.mockReturnValue('formatted prompt');
      mockAiService.callChat.mockResolvedValue('Article summary');
      mockAiService.getEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);

      await service.processArticles(FeedProfile.DEFAULT, 10);

      expect(mockConfigService.formatPrompt).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ article_title: 'test-feed' }),
      );
    });

    it('uses "Untitled" when both title and feed_source are empty', async () => {
      const articleNoTitleNoFeed: DBArticle = {
        ...mockArticle,
        title: '',
        feed_source: '',
      };
      mockArticlesService.getUnprocessedArticles.mockResolvedValue([articleNoTitleNoFeed]);
      mockProfilesService.getPromptsForProfile.mockReturnValue({
        articleSummary: '{article_title}: {article_content}',
        impactRating: undefined,
      });
      mockConfigService.formatPrompt.mockReturnValue('formatted prompt');
      mockAiService.callChat.mockResolvedValue('Article summary');
      mockAiService.getEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);

      await service.processArticles(FeedProfile.DEFAULT, 10);

      expect(mockConfigService.formatPrompt).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ article_title: 'Untitled' }),
      );
    });
  });

  describe('processArticles - backward compatibility (custom prompt)', () => {
    it('sends base prompt to AI when article has no custom_prompt', async () => {
      const articleWithoutCustomPrompt: DBArticle = {
        ...mockArticle,
        custom_prompt: undefined,
      };
      mockArticlesService.getUnprocessedArticles.mockResolvedValue([
        articleWithoutCustomPrompt,
      ]);
      mockAiService.callChat.mockResolvedValue('Article summary');
      mockAiService.getEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);

      await service.processArticles(FeedProfile.DEFAULT, 10);

      expect(mockAiService.callChat).toHaveBeenCalledWith('summary prompt');
      expect(mockAiService.callChat).not.toHaveBeenCalledWith(
        expect.stringContaining('Additional instructions:'),
      );
    });

    it('sends base prompt to AI when article has custom_prompt null', async () => {
      const articleWithNullCustomPrompt: DBArticle = {
        ...mockArticle,
        custom_prompt: null,
      };
      mockArticlesService.getUnprocessedArticles.mockResolvedValue([
        articleWithNullCustomPrompt,
      ]);
      mockAiService.callChat.mockResolvedValue('Article summary');
      mockAiService.getEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);

      await service.processArticles(FeedProfile.DEFAULT, 10);

      expect(mockAiService.callChat).toHaveBeenCalledWith('summary prompt');
    });

    it('appends custom prompt when article has custom_prompt set', async () => {
      const articleWithCustomPrompt: DBArticle = {
        ...mockArticle,
        custom_prompt: 'Focus on security implications.',
      };
      mockArticlesService.getUnprocessedArticles.mockResolvedValue([
        articleWithCustomPrompt,
      ]);
      mockAiService.callChat.mockResolvedValue('Article summary');
      mockAiService.getEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);

      await service.processArticles(FeedProfile.DEFAULT, 10);

      expect(mockAiService.callChat).toHaveBeenCalledWith(
        'summary prompt\n\nAdditional instructions: Focus on security implications.',
      );
    });
  });

  describe('processArticles - embedding failure isolation', () => {
    it('should continue processing when embedding fails and save article without embedding', async () => {
      mockAiService.callChat.mockResolvedValue('Article summary');
      mockAiService.getEmbedding.mockRejectedValue(new Error('Embedding API error'));

      const result = await service.processArticles(FeedProfile.DEFAULT, 10);

      expect(mockAiService.callChat).toHaveBeenCalled();
      expect(mockAiService.getEmbedding).toHaveBeenCalled();
      expect(mockArticlesService.updateArticleProcessing).toHaveBeenCalledWith(
        'article-1',
        expect.stringContaining('Article summary'),
        null,
      );
      expect(result.articlesProcessed).toBe(1);
      expect(result.errors).toBe(1);
    });

    it('should send email notification when embedding fails and email config is set', async () => {
      mockAiService.callChat.mockResolvedValue('Article summary');
      mockAiService.getEmbedding.mockRejectedValue(new Error('Embedding API error'));
      mockConfigService.getEmbeddingFailureNotificationEmail.mockReturnValue({
        to: 'admin@example.com',
        from: 'noreply@example.com',
      });
      mockEmailService.sendEmail.mockResolvedValue({ success: true });

      await service.processArticles(FeedProfile.DEFAULT, 10);

      expect(mockConfigService.getEmbeddingFailureNotificationEmail).toHaveBeenCalled();
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith({
        from: 'noreply@example.com',
        to: 'admin@example.com',
        subject: 'Embedding Generation Failed',
        text: expect.stringContaining('article-1'),
      });
    });

    it('should log warning when embedding fails but email config is not set', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'warn');
      mockAiService.callChat.mockResolvedValue('Article summary');
      mockAiService.getEmbedding.mockRejectedValue(new Error('Embedding API error'));
      mockConfigService.getEmbeddingFailureNotificationEmail.mockReturnValue(null);

      await service.processArticles(FeedProfile.DEFAULT, 10);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('EMBEDDING_FAILURE_NOTIFICATION_EMAIL'),
      );
      expect(mockEmailService.sendEmail).not.toHaveBeenCalled();
    });

    it('should handle email send failure gracefully', async () => {
      mockAiService.callChat.mockResolvedValue('Article summary');
      mockAiService.getEmbedding.mockRejectedValue(new Error('Embedding API error'));
      mockConfigService.getEmbeddingFailureNotificationEmail.mockReturnValue({
        to: 'admin@example.com',
        from: 'noreply@example.com',
      });
      mockEmailService.sendEmail.mockRejectedValue(new Error('Email send failed'));

      const result = await service.processArticles(FeedProfile.DEFAULT, 10);

      expect(mockArticlesService.updateArticleProcessing).toHaveBeenCalled();
      expect(result.articlesProcessed).toBe(1);
    });

    it('should process multiple articles even if embedding fails for some', async () => {
      const article2: DBArticle = {
        ...mockArticle,
        id: 'article-2',
        title: 'Second Article',
      };

      mockArticlesService.getUnprocessedArticles.mockResolvedValue([mockArticle, article2]);
      mockAiService.callChat.mockResolvedValue('Article summary');
      mockAiService.getEmbedding
        .mockRejectedValueOnce(new Error('Embedding API error'))
        .mockResolvedValueOnce([0.1, 0.2, 0.3]);

      const result = await service.processArticles(FeedProfile.DEFAULT, 10);

      expect(mockArticlesService.updateArticleProcessing).toHaveBeenCalledTimes(2);
      expect(mockArticlesService.updateArticleProcessing).toHaveBeenNthCalledWith(
        1,
        'article-1',
        expect.any(String),
        null,
      );
      expect(mockArticlesService.updateArticleProcessing).toHaveBeenNthCalledWith(
        2,
        'article-2',
        expect.any(String),
        [0.1, 0.2, 0.3],
      );
      expect(result.articlesProcessed).toBe(2);
      expect(result.errors).toBe(1);
    });

    it('should increment error count when embedding fails', async () => {
      mockAiService.callChat.mockResolvedValue('Article summary');
      mockAiService.getEmbedding.mockRejectedValue(new Error('Embedding API error'));

      const result = await service.processArticles(FeedProfile.DEFAULT, 10);

      expect(result.errors).toBe(1);
    });

    it('should handle null return from getEmbedding without throwing', async () => {
      mockAiService.callChat.mockResolvedValue('Article summary');
      mockAiService.getEmbedding.mockResolvedValue(null);
      mockConfigService.getEmbeddingFailureNotificationEmail.mockReturnValue({
        to: 'admin@example.com',
        from: 'noreply@example.com',
      });
      mockEmailService.sendEmail.mockResolvedValue({ success: true });

      const result = await service.processArticles(FeedProfile.DEFAULT, 10);

      expect(mockAiService.getEmbedding).toHaveBeenCalled();
      expect(mockArticlesService.updateArticleProcessing).toHaveBeenCalledWith(
        'article-1',
        expect.stringContaining('Article summary'),
        null,
      );
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith({
        from: 'noreply@example.com',
        to: 'admin@example.com',
        subject: 'Embedding Generation Failed',
        text: expect.stringContaining('Embedding returned null'),
      });
      expect(result.articlesProcessed).toBe(1);
      expect(result.errors).toBe(1);
    });
  });
});
