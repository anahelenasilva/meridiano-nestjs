import { AUDIO_GENERATION_SUCCESS_MESSAGE } from '@libs/audio';
import { IS_PUBLIC_KEY } from '@libs/auth';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { mock } from 'jest-mock-extended';
import { ArticlesController } from './articles.controller';
import { GenerateArticleAudioCommand } from './commands/generate-article-audio.command';
import { GetArticleByIdQuery } from './queries/get-article-by-id.query';
import type { AuthenticatedRequest } from '../shared/types/authenticated-request';

describe('ArticlesController', () => {
  const mockGenerateArticleAudioCommand = mock<GenerateArticleAudioCommand>();
  const mockGetArticleByIdQuery = mock<GetArticleByIdQuery>();

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
    const mockRequest = { user: { id: userId } } as AuthenticatedRequest;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    function buildController() {
      return new ArticlesController(
        mock(),
        mock(),
        mockGetArticleByIdQuery,
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

      const result = await controller.getArticle(
        mockRequest,
        articleId,
        'true',
      );

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

      await controller.getArticle(mockRequest, articleId, undefined);

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
        controller.getArticle(mockRequest, articleId, undefined),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the query result has no article', async () => {
      mockGetArticleByIdQuery.execute.mockResolvedValue({
        article: null,
        related_articles: [],
      } as never);

      const controller = buildController();

      await expect(
        controller.getArticle(mockRequest, articleId, undefined),
      ).rejects.toThrow(NotFoundException);
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
        mock(),
        mock(),
        mock(),
        mock(),
        mock(),
        mock(),
        mockGenerateArticleAudioCommand,
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
        mock(),
        mock(),
        mock(),
        mock(),
        mock(),
        mock(),
        mockGenerateArticleAudioCommand,
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
        mock(),
        mock(),
        mock(),
        mock(),
        mock(),
        mock(),
        mockGenerateArticleAudioCommand,
      );

      await expect(
        controller.generateAudio('11111111-1111-1111-1111-111111111111'),
      ).rejects.toThrow(ConflictException);
    });
  });
});
