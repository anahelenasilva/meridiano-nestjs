import { AUDIO_GENERATION_SUCCESS_MESSAGE, AudioJobService } from '@libs/audio';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { mock } from 'jest-mock-extended';
import { AudioFilesService } from '../../audio-files/audio-files.service';
import type { DBArticle } from '../article.entity';
import { ArticlesService } from '../articles.service';
import { GenerateArticleAudioCommand } from './generate-article-audio.command';

describe('GenerateArticleAudioCommand', () => {
  let command: GenerateArticleAudioCommand;
  const mockArticlesService = mock<ArticlesService>();
  const mockAudioFilesService = mock<AudioFilesService>();
  const mockAudioJobService = mock<AudioJobService>();

  const articleId = '11111111-1111-1111-1111-111111111111';
  const mockArticle: DBArticle = {
    id: articleId,
    url: 'https://example.com/article',
    title: 'Test Article',
    published_date: new Date('2024-01-01'),
    feed_source: 'test',
    raw_content: 'Raw content',
    processed_content: 'Processed content',
    feed_profile: 'default',
    created_at: new Date('2024-01-01'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    command = new GenerateArticleAudioCommand(
      mockArticlesService,
      mockAudioFilesService,
      mockAudioJobService,
    );
  });

  it('should be defined', () => {
    expect(command).toBeDefined();
  });

  describe('execute', () => {
    it('should return jobId and message when article exists with content and no existing audio', async () => {
      mockArticlesService.getArticleById.mockResolvedValue(mockArticle);
      mockAudioFilesService.getAudioFileBySource.mockResolvedValue(null);
      mockAudioJobService.enqueueAudioJobIfNotDuplicate.mockResolvedValue({
        jobId: 'job-123',
        status: 'queued',
      });

      const result = await command.execute(articleId);

      expect(result).toEqual({
        jobId: 'job-123',
        message: AUDIO_GENERATION_SUCCESS_MESSAGE,
      });
      expect(mockArticlesService.getArticleById).toHaveBeenCalledWith(articleId);
      expect(mockAudioFilesService.getAudioFileBySource).toHaveBeenCalledWith(
        'article',
        articleId,
      );
      expect(
        mockAudioJobService.enqueueAudioJobIfNotDuplicate,
      ).toHaveBeenCalledWith({
        sourceType: 'article',
        sourceId: articleId,
        text: 'Processed content',
        date: mockArticle.published_date,
      });
    });

    it('should use raw_content when processed_content is empty', async () => {
      const articleWithRawOnly = {
        ...mockArticle,
        processed_content: null,
        raw_content: 'Raw only content',
      };
      mockArticlesService.getArticleById.mockResolvedValue(articleWithRawOnly);
      mockAudioFilesService.getAudioFileBySource.mockResolvedValue(null);
      mockAudioJobService.enqueueAudioJobIfNotDuplicate.mockResolvedValue({
        jobId: 'job-456',
        status: 'queued',
      });

      await command.execute(articleId);

      expect(
        mockAudioJobService.enqueueAudioJobIfNotDuplicate,
      ).toHaveBeenCalledWith({
        sourceType: 'article',
        sourceId: articleId,
        text: 'Raw only content',
        date: mockArticle.published_date,
      });
    });

    it('should throw NotFoundException when article does not exist', async () => {
      mockArticlesService.getArticleById.mockResolvedValue(null);

      await expect(command.execute(articleId)).rejects.toThrow(NotFoundException);
      await expect(command.execute(articleId)).rejects.toMatchObject({
        message: 'Article not found',
      });

      expect(
        mockAudioJobService.enqueueAudioJobIfNotDuplicate,
      ).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when audio already exists', async () => {
      mockArticlesService.getArticleById.mockResolvedValue(mockArticle);
      mockAudioFilesService.getAudioFileBySource.mockResolvedValue({
        id: 'audio-1',
        source_type: 'article',
        source_id: articleId,
        s3_bucket: 'bucket',
        s3_key: 'key',
        file_size_bytes: 1000,
        created_at: new Date(),
      });

      await expect(command.execute(articleId)).rejects.toThrow(ConflictException);
      await expect(command.execute(articleId)).rejects.toMatchObject({
        message:
          'Audio already exists for this resource. Use the detail endpoint with includeAudio=true to fetch the audio.',
      });

      expect(
        mockAudioJobService.enqueueAudioJobIfNotDuplicate,
      ).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when article has no content', async () => {
      const emptyArticle = {
        ...mockArticle,
        processed_content: null,
        raw_content: '',
      };
      mockArticlesService.getArticleById.mockResolvedValue(emptyArticle);
      mockAudioFilesService.getAudioFileBySource.mockResolvedValue(null);

      await expect(command.execute(articleId)).rejects.toThrow(
        BadRequestException,
      );
      await expect(command.execute(articleId)).rejects.toMatchObject({
        message: 'Article has no content available for audio generation',
      });

      expect(
        mockAudioJobService.enqueueAudioJobIfNotDuplicate,
      ).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when content is only whitespace', async () => {
      const whitespaceArticle = {
        ...mockArticle,
        processed_content: '   ',
        raw_content: '   ',
      };
      mockArticlesService.getArticleById.mockResolvedValue(whitespaceArticle);
      mockAudioFilesService.getAudioFileBySource.mockResolvedValue(null);

      await expect(command.execute(articleId)).rejects.toThrow(
        BadRequestException,
      );

      expect(
        mockAudioJobService.enqueueAudioJobIfNotDuplicate,
      ).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when generation is already in progress', async () => {
      mockArticlesService.getArticleById.mockResolvedValue(mockArticle);
      mockAudioFilesService.getAudioFileBySource.mockResolvedValue(null);
      mockAudioJobService.enqueueAudioJobIfNotDuplicate.mockResolvedValue(null);

      await expect(command.execute(articleId)).rejects.toThrow(ConflictException);
      await expect(command.execute(articleId)).rejects.toMatchObject({
        message: 'Audio generation is already in progress for this resource.',
      });
    });
  });
});
