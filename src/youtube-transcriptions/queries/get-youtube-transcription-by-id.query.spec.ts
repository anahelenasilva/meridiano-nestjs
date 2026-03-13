import { S3Service } from '@libs/s3';
import { mock } from 'jest-mock-extended';
import { ConfigService } from '../../config/config.service';
import { AudioFilesService } from '../../audio-files/audio-files.service';
import { YoutubeTranscription } from '../entities/youtube-transcription.entity';
import { YoutubeTranscriptionsService } from '../services/youtube-transcriptions.service';
import { GetYoutubeTranscriptionByIdQuery } from './get-youtube-transcription-by-id.query';

describe('GetYoutubeTranscriptionByIdQuery', () => {
  const mockService = mock<YoutubeTranscriptionsService>();
  const mockAudioFilesService = mock<AudioFilesService>();
  const mockS3Service = mock<S3Service>();
  const mockConfigService = mock<ConfigService>();

  const transcriptionId = '11111111-1111-1111-1111-111111111111';
  const mockTranscription: YoutubeTranscription = {
    id: transcriptionId,
    channelId: 'channel-1',
    channelName: 'Test Channel',
    videoTitle: 'Test Video',
    videoUrl: 'https://youtube.com/watch?v=abc',
    processedAt: new Date('2024-01-01'),
    transcriptionText: 'Full transcription text',
    transcriptionSummary: 'Summary',
    postedAt: new Date('2024-01-01'),
  };

  let query: GetYoutubeTranscriptionByIdQuery;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfigService.getPresignedUrlExpirySeconds.mockReturnValue(3600);
    query = new GetYoutubeTranscriptionByIdQuery(
      mockService,
      mockAudioFilesService,
      mockS3Service,
      mockConfigService,
    );
  });

  it('should return transcription without audio when includeAudio is false', async () => {
    mockService.getTranscriptionById.mockResolvedValue(mockTranscription);

    const result = await query.execute(transcriptionId, false);

    expect(result).toEqual({ transcription: mockTranscription });
    expect(mockAudioFilesService.getAudioFileBySource).not.toHaveBeenCalled();
  });

  it('should return transcription with audio when includeAudio=true and audio exists', async () => {
    mockService.getTranscriptionById.mockResolvedValue(mockTranscription);
    mockAudioFilesService.getAudioFileBySource.mockResolvedValue({
      id: 'audio-1',
      source_type: 'transcription',
      source_id: transcriptionId,
      s3_bucket: 'bucket',
      s3_key: 'audio/key.mp3',
      file_size_bytes: 1000,
      duration_seconds: 120,
      created_at: new Date(),
    });
    mockS3Service.generatePresignedGetUrl.mockResolvedValue(
      'https://s3.example.com/presigned',
    );

    const result = await query.execute(transcriptionId, true);

    expect(result).toEqual({
      transcription: mockTranscription,
      audio: {
        id: 'audio-1',
        s3_key: 'audio/key.mp3',
        file_size_bytes: 1000,
        duration_seconds: 120,
        presigned_url: 'https://s3.example.com/presigned',
      },
    });
    expect(mockAudioFilesService.getAudioFileBySource).toHaveBeenCalledWith(
      'transcription',
      transcriptionId,
    );
  });

  it('should return transcription with audio_error when includeAudio=true but no audio exists', async () => {
    mockService.getTranscriptionById.mockResolvedValue(mockTranscription);
    mockAudioFilesService.getAudioFileBySource.mockResolvedValue(null);

    const result = await query.execute(transcriptionId, true);

    expect(result).toEqual({
      transcription: mockTranscription,
      audio_error: 'Audio not available for this resource',
    });
    expect(mockAudioFilesService.getAudioFileBySource).toHaveBeenCalledWith(
      'transcription',
      transcriptionId,
    );
    expect(mockS3Service.generatePresignedGetUrl).not.toHaveBeenCalled();
  });

  it('should include custom_prompt in response when transcription has custom_prompt null (backward compat)', async () => {
    const transcriptionWithNullCustomPrompt = {
      ...mockTranscription,
      custom_prompt: null as string | null,
    };
    mockService.getTranscriptionById.mockResolvedValue(
      transcriptionWithNullCustomPrompt,
    );

    const result = await query.execute(transcriptionId, false);

    expect(result).not.toBeNull();
    expect(result?.transcription).toHaveProperty('custom_prompt', null);
  });

  it('should include custom_prompt in response when transcription has custom_prompt set', async () => {
    const transcriptionWithCustomPrompt = {
      ...mockTranscription,
      custom_prompt: 'Focus on technical details.',
    };
    mockService.getTranscriptionById.mockResolvedValue(
      transcriptionWithCustomPrompt,
    );

    const result = await query.execute(transcriptionId, false);

    expect(result).not.toBeNull();
    expect(result?.transcription).toHaveProperty(
      'custom_prompt',
      'Focus on technical details.',
    );
  });

  it('should return null when transcription does not exist', async () => {
    mockService.getTranscriptionById.mockResolvedValue(null);

    const result = await query.execute(transcriptionId);

    expect(result).toBeNull();
    expect(mockAudioFilesService.getAudioFileBySource).not.toHaveBeenCalled();
  });

  it('should return transcription with audio_error when audio fetch throws', async () => {
    mockService.getTranscriptionById.mockResolvedValue(mockTranscription);
    mockAudioFilesService.getAudioFileBySource.mockRejectedValue(
      new Error('DB connection failed'),
    );

    const result = await query.execute(transcriptionId, true);

    expect(result).toEqual({
      transcription: mockTranscription,
      audio_error: 'Failed to fetch audio',
    });
    expect(mockS3Service.generatePresignedGetUrl).not.toHaveBeenCalled();
  });

  it('should return audio with required playback contract fields for HTML5/player controls', async () => {
    mockService.getTranscriptionById.mockResolvedValue(mockTranscription);
    mockAudioFilesService.getAudioFileBySource.mockResolvedValue({
      id: 'audio-1',
      source_type: 'transcription',
      source_id: transcriptionId,
      s3_bucket: 'bucket',
      s3_key: 'audio/key.mp3',
      file_size_bytes: 1000,
      duration_seconds: 120,
      created_at: new Date(),
    });
    mockS3Service.generatePresignedGetUrl.mockResolvedValue(
      'https://s3.example.com/presigned',
    );

    const result = await query.execute(transcriptionId, true);

    expect(result).not.toBeNull();
    expect(result?.audio).toBeDefined();
    const audio = result?.audio;
    expect(audio).toBeDefined();
    expect(audio).toHaveProperty('id');
    expect(audio).toHaveProperty('s3_key');
    expect(audio).toHaveProperty('file_size_bytes');
    expect(audio).toHaveProperty('presigned_url');
    if (!audio) throw new Error('Test setup failed');
    expect(typeof audio.presigned_url).toBe('string');
    expect(audio.presigned_url.length).toBeGreaterThan(0);
  });
});
