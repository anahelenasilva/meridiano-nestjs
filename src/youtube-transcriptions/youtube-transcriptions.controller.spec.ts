import { AUDIO_GENERATION_SUCCESS_MESSAGE, AudioJobService } from '@libs/audio';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { mock } from 'jest-mock-extended';
import { AudioFilesService } from '../audio-files/audio-files.service';
import { CreateYoutubeTranscriptionCommand } from './commands/create-youtube-transcription.command';
import { DeleteYoutubeTranscriptionCommand } from './commands/delete-youtube-transcription.command';
import { YoutubeTranscription } from './entities/youtube-transcription.entity';
import { GetYoutubeTranscriptionByIdQuery } from './queries/get-youtube-transcription-by-id.query';
import { ListAllYoutubeTranscriptionsQuery } from './queries/list-all-youtube-transcriptions.query';
import { YoutubeTranscriptionsService } from './services/youtube-transcriptions.service';
import { YoutubeTranscriptionsController } from './youtube-transcriptions.controller';

describe('YoutubeTranscriptionsController', () => {
  let controller: YoutubeTranscriptionsController;
  const mockYoutubeTranscriptionsService = mock<YoutubeTranscriptionsService>();
  const mockAudioJobService = mock<AudioJobService>();
  const mockAudioFilesService = mock<AudioFilesService>();

  const transcriptionId = '11111111-1111-1111-1111-111111111111';
  const mockTranscription: YoutubeTranscription = {
    id: transcriptionId,
    channelId: 'channel-1',
    channelName: 'Test Channel',
    videoTitle: 'Test Video',
    videoUrl: 'https://youtube.com/watch?v=abc',
    processedAt: new Date('2024-01-01'),
    transcriptionText: 'Full transcription text for TTS',
    transcriptionSummary: 'Summary for TTS',
    postedAt: new Date('2024-01-01'),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    const mockListAllYoutubeTranscriptionsQuery =
      new ListAllYoutubeTranscriptionsQuery(mockYoutubeTranscriptionsService);
    const mockGetYoutubeTranscriptionByIdQuery =
      new GetYoutubeTranscriptionByIdQuery(mockYoutubeTranscriptionsService);
    const mockDeleteYoutubeTranscriptionCommand =
      new DeleteYoutubeTranscriptionCommand(mockYoutubeTranscriptionsService);
    const mockCreateYoutubeTranscriptionCommand =
      new CreateYoutubeTranscriptionCommand(mockYoutubeTranscriptionsService);

    controller = new YoutubeTranscriptionsController(
      mockListAllYoutubeTranscriptionsQuery,
      mockGetYoutubeTranscriptionByIdQuery,
      mockDeleteYoutubeTranscriptionCommand,
      mockCreateYoutubeTranscriptionCommand,
      mockAudioJobService,
      mockAudioFilesService,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('generateAudio', () => {
    it('should return 202 with jobId and message when transcription exists with no audio', async () => {
      mockYoutubeTranscriptionsService.getTranscriptionById.mockResolvedValue(
        mockTranscription,
      );
      mockAudioFilesService.getAudioFileBySource.mockResolvedValue(null);
      mockAudioJobService.enqueueAudioJobIfNotDuplicate.mockResolvedValue({
        jobId: 'job-123',
        status: 'queued',
      });

      const result = await controller.generateAudio(transcriptionId);

      expect(result).toEqual({
        jobId: 'job-123',
        message: AUDIO_GENERATION_SUCCESS_MESSAGE,
      });
      expect(
        mockAudioJobService.enqueueAudioJobIfNotDuplicate,
      ).toHaveBeenCalledWith({
        sourceType: 'transcription',
        sourceId: transcriptionId,
        text: mockTranscription.transcriptionSummary,
        date: mockTranscription.postedAt,
      });
    });

    it('should use transcriptionText when transcriptionSummary is empty', async () => {
      const transcriptionWithoutSummary = {
        ...mockTranscription,
        transcriptionSummary: undefined,
      };
      mockYoutubeTranscriptionsService.getTranscriptionById.mockResolvedValue(
        transcriptionWithoutSummary,
      );
      mockAudioFilesService.getAudioFileBySource.mockResolvedValue(null);
      mockAudioJobService.enqueueAudioJobIfNotDuplicate.mockResolvedValue({
        jobId: 'job-456',
        status: 'queued',
      });

      await controller.generateAudio(transcriptionId);

      expect(
        mockAudioJobService.enqueueAudioJobIfNotDuplicate,
      ).toHaveBeenCalledWith({
        sourceType: 'transcription',
        sourceId: transcriptionId,
        text: mockTranscription.transcriptionText,
        date: mockTranscription.postedAt,
      });
    });

    it('should throw NotFoundException when transcription does not exist', async () => {
      mockYoutubeTranscriptionsService.getTranscriptionById.mockResolvedValue(
        null,
      );

      await expect(
        controller.generateAudio('00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow(NotFoundException);

      expect(
        mockAudioJobService.enqueueAudioJobIfNotDuplicate,
      ).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when audio already exists', async () => {
      mockYoutubeTranscriptionsService.getTranscriptionById.mockResolvedValue(
        mockTranscription,
      );
      mockAudioFilesService.getAudioFileBySource.mockResolvedValue({
        id: 'audio-1',
        source_type: 'transcription',
        source_id: transcriptionId,
        s3_bucket: 'bucket',
        s3_key: 'key',
        file_size_bytes: 1000,
        created_at: new Date(),
      });

      const result = controller.generateAudio(transcriptionId);

      await expect(result).rejects.toThrow(ConflictException);
      await expect(result).rejects.toMatchObject({
        message:
          'Audio already exists for this resource. Use the detail endpoint with includeAudio=true to fetch the audio.',
      });

      expect(
        mockAudioJobService.enqueueAudioJobIfNotDuplicate,
      ).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when transcription has no content', async () => {
      const emptyTranscription = {
        ...mockTranscription,
        transcriptionText: '',
        transcriptionSummary: '',
      };
      mockYoutubeTranscriptionsService.getTranscriptionById.mockResolvedValue(
        emptyTranscription,
      );
      mockAudioFilesService.getAudioFileBySource.mockResolvedValue(null);

      await expect(controller.generateAudio(transcriptionId)).rejects.toThrow(
        BadRequestException,
      );

      expect(
        mockAudioJobService.enqueueAudioJobIfNotDuplicate,
      ).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when generation is already in progress', async () => {
      mockYoutubeTranscriptionsService.getTranscriptionById.mockResolvedValue(
        mockTranscription,
      );
      mockAudioFilesService.getAudioFileBySource.mockResolvedValue(null);
      mockAudioJobService.enqueueAudioJobIfNotDuplicate.mockResolvedValue(null);

      const result = controller.generateAudio(transcriptionId);

      await expect(result).rejects.toThrow(ConflictException);
      await expect(result).rejects.toMatchObject({
        message: 'Audio generation is already in progress for this resource.',
      });
    });
  });
});
