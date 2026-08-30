import { AUDIO_GENERATION_SUCCESS_MESSAGE } from '@libs/audio';
import { IS_PUBLIC_KEY } from '@libs/auth';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { mock } from 'jest-mock-extended';
import { ArticlesController } from './articles.controller';
import { GenerateArticleAudioCommand } from './commands/generate-article-audio.command';
import { GetArticleByIdQuery } from './queries/get-article-by-id.query';
import { ListArticlesLeanQuery } from './queries/list-articles-lean.query';
import { ListArticlesQuery } from './queries/list-articles.query';

describe('ArticlesController', () => {
  const mockGenerateArticleAudioCommand = mock<GenerateArticleAudioCommand>();
  const mockGetArticleByIdQuery = mock<GetArticleByIdQuery>();
  const mockListArticlesQuery = mock<ListArticlesQuery>();
  const mockListArticlesLeanQuery = mock<ListArticlesLeanQuery>();

  it('should not have @Public() on generateAudio endpoint', () => {
    const isPublic = Reflect.getMetadata(
      IS_PUBLIC_KEY,
      ArticlesController.prototype,
      'generateAudio',
    );
    expect(isPublic).toBeUndefined();
  });

  it('should not have @Public() on getArticle endpoint (playback access)', () => {
    const isPublic = Reflect.getMetadata(
      IS_PUBLIC_KEY,
      ArticlesController.prototype,
      'getArticle',
    );
    expect(isPublic).toBeUndefined();
  });

  describe('getArticle', () => {
    const articleId = '11111111-1111-1111-1111-111111111111';
    const userId = 'user-1';

    beforeEach(() => {
      jest.clearAllMocks();
    });

    function buildController() {
      return new ArticlesController(
        mock(),
        mockListArticlesQuery,
        mockListArticlesLeanQuery,
        mockGetArticleByIdQuery,
        mock(),
        mock(),
        mock(),
        mock(),
        mock(),
        mock(),
      );
    }

    it('forwards id, request.user.id, and parsed includeAudio to the query in order', async () => {
      const expectedResponse = {
        article: { id: articleId },
        related_articles: [],
      };
      mockGetArticleByIdQuery.execute.mockResolvedValue(
        expectedResponse as never,
      );

      const controller = buildController();

      const result = await controller.getArticle({ id: userId }, articleId, 'true');

      expect(result).toEqual(expectedResponse);
      expect(mockGetArticleByIdQuery.execute).toHaveBeenCalledWith(
        articleId,
        userId,
        true,
      );
    });

    it('parses a falsy/omitted includeAudio into false', async () => {
      mockGetArticleByIdQuery.execute.mockResolvedValue({
        article: { id: articleId },
        related_articles: [],
      } as never);

      const controller = buildController();

      await controller.getArticle({ id: userId }, articleId, undefined);

      expect(mockGetArticleByIdQuery.execute).toHaveBeenCalledWith(
        articleId,
        userId,
        false,
      );
    });

    it('throws NotFoundException when the query returns null', async () => {
      mockGetArticleByIdQuery.execute.mockResolvedValue(null as never);

      const controller = buildController();

      await expect(
        controller.getArticle({ id: userId }, articleId, undefined),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the query result has no article', async () => {
      mockGetArticleByIdQuery.execute.mockResolvedValue({
        article: null,
        related_articles: [],
      } as never);

      const controller = buildController();

      await expect(
        controller.getArticle({ id: userId }, articleId, undefined),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listArticles', () => {
    it('forwards the authenticated user id into the list query', async () => {
      const response = {
        articles: [],
        pagination: {
          page: 1,
          per_page: 20,
          total_pages: 0,
          total_articles: 0,
        },
        filters: {
          sort_by: 'published_date',
          direction: 'desc',
          feed_profile: '',
          search_term: '',
          start_date: '',
          end_date: '',
          preset: '',
          category: '',
        },
        available_profiles: [],
        available_categories: [],
      };
      mockListArticlesQuery.execute.mockResolvedValue(response as never);

      const controller = new ArticlesController(
        mock(),
        mockListArticlesQuery,
        mockListArticlesLeanQuery,
        mock(),
        mock(),
        mock(),
        mock(),
        mock(),
        mock(),
        mock(),
      );
      const input = { page: 2, perPage: 10 };

      const result = await controller.listArticles({ id: 'user-1' }, input);

      expect(result).toEqual(response);
      expect(mockListArticlesQuery.execute).toHaveBeenCalledWith('user-1', {
        ...input,
        archiveScope: 'active',
      });
    });

    it('forwards undefined user id on the api-key path (no authenticated user)', async () => {
      mockListArticlesQuery.execute.mockResolvedValue({ articles: [] } as never);

      const controller = new ArticlesController(
        mock(),
        mockListArticlesQuery,
        mockListArticlesLeanQuery,
        mock(),
        mock(),
        mock(),
        mock(),
        mock(),
        mock(),
        mock(),
      );
      const input = { page: 1, perPage: 20 };

      await controller.listArticles(undefined, input);

      expect(mockListArticlesQuery.execute).toHaveBeenCalledWith(undefined, {
        ...input,
        archiveScope: 'active',
      });
    });
  });

  describe('listArticlesLean', () => {
    function buildController() {
      return new ArticlesController(
        mock(),
        mockListArticlesQuery,
        mockListArticlesLeanQuery,
        mock(),
        mock(),
        mock(),
        mock(),
        mock(),
        mock(),
        mock(),
      );
    }

    it('forwards the authenticated user id and input into the lean query', async () => {
      mockListArticlesLeanQuery.execute.mockResolvedValue({
        articles: [],
      } as never);
      const input = { page: 2, perPage: 10 };

      await buildController().listArticlesLean({ id: 'user-1' }, input);

      expect(mockListArticlesLeanQuery.execute).toHaveBeenCalledWith(
        'user-1',
        input,
      );
    });

    it('forwards undefined user id on the api-key path', async () => {
      mockListArticlesLeanQuery.execute.mockResolvedValue({
        articles: [],
      } as never);
      const input = { page: 1, perPage: 20 };

      await buildController().listArticlesLean(undefined, input);

      expect(mockListArticlesLeanQuery.execute).toHaveBeenCalledWith(
        undefined,
        input,
      );
    });
  });

  describe('generateAudio', () => {
    it('should delegate to GenerateArticleAudioCommand and return response contract', async () => {
      const articleId = '11111111-1111-1111-1111-111111111111';
      const expectedResponse = {
        jobId: 'job-123',
        message: AUDIO_GENERATION_SUCCESS_MESSAGE,
      };
      mockGenerateArticleAudioCommand.execute.mockResolvedValue(expectedResponse);

      const controller = new ArticlesController(
        mock(),
        mockListArticlesQuery,
        mockListArticlesLeanQuery,
        mock(),
        mock(),
        mock(),
        mock(),
        mock(),
        mockGenerateArticleAudioCommand,
        mock(),
      );

      const result = await controller.generateAudio(articleId);

      expect(result).toEqual(expectedResponse);
      expect(mockGenerateArticleAudioCommand.execute).toHaveBeenCalledWith(
        articleId,
      );
    });

    it('should propagate NotFoundException from command', async () => {
      mockGenerateArticleAudioCommand.execute.mockRejectedValue(
        new NotFoundException('Article not found'),
      );

      const controller = new ArticlesController(
        mock(),
        mockListArticlesQuery,
        mockListArticlesLeanQuery,
        mock(),
        mock(),
        mock(),
        mock(),
        mock(),
        mockGenerateArticleAudioCommand,
        mock(),
      );

      await expect(
        controller.generateAudio('00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should propagate ConflictException from command', async () => {
      mockGenerateArticleAudioCommand.execute.mockRejectedValue(
        new ConflictException('Audio already exists for this resource.'),
      );

      const controller = new ArticlesController(
        mock(),
        mockListArticlesQuery,
        mockListArticlesLeanQuery,
        mock(),
        mock(),
        mock(),
        mock(),
        mock(),
        mockGenerateArticleAudioCommand,
        mock(),
      );

      await expect(
        controller.generateAudio('11111111-1111-1111-1111-111111111111'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('listArticles archive scope', () => {
    function buildController() {
      return new ArticlesController(
        mock(),
        mockListArticlesQuery,
        mockListArticlesLeanQuery,
        mockGetArticleByIdQuery,
        mock(),
        mock(),
        mock(),
        mock(),
        mock(),
        mock(),
      );
    }

    beforeEach(() => {
      jest.clearAllMocks();
      mockListArticlesQuery.execute.mockResolvedValue(null);
    });

    it('defaults to the active scope when archive_scope is absent', async () => {
      const controller = buildController();

      await controller.listArticles({ id: 'user-1' }, { page: 1 }, undefined);

      expect(mockListArticlesQuery.execute).toHaveBeenCalledWith('user-1', {
        page: 1,
        archiveScope: 'active',
      });
    });

    it('forwards the archived scope', async () => {
      const controller = buildController();

      await controller.listArticles({ id: 'user-1' }, { page: 1 }, 'archived');

      expect(mockListArticlesQuery.execute).toHaveBeenCalledWith('user-1', {
        page: 1,
        archiveScope: 'archived',
      });
    });

    it('rejects an unrecognised scope with a 400 rather than silently defaulting', async () => {
      const controller = buildController();

      await expect(
        controller.listArticles({ id: 'user-1' }, {}, 'deleted'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockListArticlesQuery.execute).not.toHaveBeenCalled();
    });
  });
});
