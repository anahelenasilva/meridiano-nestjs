import { S3Service } from '@libs/s3';
import { mock } from 'jest-mock-extended';
import { AudioFilesCleanupService } from './audio-files-cleanup.service';
import { AudioFile, AudioFilesService } from './audio-files.service';

describe('AudioFilesCleanupService', () => {
  const mockAudioFilesService = mock<AudioFilesService>();
  const mockS3Service = mock<S3Service>();

  let service: AudioFilesCleanupService;

  const audioFile: AudioFile = {
    id: 'audio-1',
    source_type: 'article',
    source_id: '11111111-1111-1111-1111-111111111111',
    s3_bucket: 'meridiano-articles',
    s3_key: 'audio/2026-08-22/article-11111111-1111-1111-1111-111111111111.mp3',
    file_size_bytes: 1024,
    created_at: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AudioFilesCleanupService(mockAudioFilesService, mockS3Service);
  });

  it('deletes the S3 object then the row for the exact key the source owns', async () => {
    mockAudioFilesService.getAudioFileBySource.mockResolvedValue(audioFile);
    mockS3Service.deleteObject.mockResolvedValue();
    mockAudioFilesService.deleteAudioFileBySource.mockResolvedValue(1);

    await service.purgeAudioForSource('article', audioFile.source_id);

    expect(mockS3Service.deleteObject).toHaveBeenCalledWith(
      audioFile.s3_bucket,
      audioFile.s3_key,
    );
    expect(mockAudioFilesService.deleteAudioFileBySource).toHaveBeenCalledWith(
      'article',
      audioFile.source_id,
    );

    const s3Order = mockS3Service.deleteObject.mock.invocationCallOrder[0];
    const dbOrder =
      mockAudioFilesService.deleteAudioFileBySource.mock
        .invocationCallOrder[0];
    expect(s3Order).toBeLessThan(dbOrder);
  });

  it('is a no-op when the source has no audio', async () => {
    mockAudioFilesService.getAudioFileBySource.mockResolvedValue(null);

    await service.purgeAudioForSource('transcription', 'no-audio-id');

    expect(mockS3Service.deleteObject).not.toHaveBeenCalled();
    expect(
      mockAudioFilesService.deleteAudioFileBySource,
    ).not.toHaveBeenCalled();
  });

  it('keeps the row when the S3 delete fails so the pointer survives for retry', async () => {
    mockAudioFilesService.getAudioFileBySource.mockResolvedValue(audioFile);
    mockS3Service.deleteObject.mockRejectedValue(new Error('s3 down'));

    await expect(
      service.purgeAudioForSource('article', audioFile.source_id),
    ).rejects.toThrow('s3 down');

    expect(
      mockAudioFilesService.deleteAudioFileBySource,
    ).not.toHaveBeenCalled();
  });
});
