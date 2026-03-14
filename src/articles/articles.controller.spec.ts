import { AUDIO_GENERATION_SUCCESS_MESSAGE } from '@libs/audio';
import { IS_PUBLIC_KEY } from '@libs/auth';
import { mock } from 'jest-mock-extended';
import { ArticlesController } from './articles.controller';
import { GenerateArticleAudioCommand } from './commands/generate-article-audio.command';

describe('ArticlesController', () => {
  const mockGenerateArticleAudioCommand = mock<GenerateArticleAudioCommand>();

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
      const { NotFoundException } = await import('@nestjs/common');
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
      const { ConflictException } = await import('@nestjs/common');
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
