import { S3Service } from '@libs/s3';
import { mock } from 'jest-mock-extended';
import { ConfigService } from '../../config/config.service';
import {
  AudioFilesService,
  AudioLibraryEntry,
} from '../audio-files.service';
import { ListAudioLibraryQuery } from './list-audio-library.query';

describe('ListAudioLibraryQuery', () => {
  const mockAudioFilesService = mock<AudioFilesService>();
  const mockS3Service = mock<S3Service>();
  const mockConfigService = mock<ConfigService>();

  let query: ListAudioLibraryQuery;

  const entry: AudioLibraryEntry = {
    audio_id: 'audio-1',
    source_type: 'article',
    source_id: 'article-1',
    s3_bucket: 'bucket',
    s3_key: 'audio/one.mp3',
    file_size_bytes: 2048,
    duration_seconds: 90,
    created_at: new Date('2026-08-01T10:00:00.000Z'),
    title: 'An Article',
    source_label: 'Some Feed',
    published_at: '2026-07-30T00:00:00.000Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfigService.getPresignedUrlExpirySeconds.mockReturnValue(3600);
    query = new ListAudioLibraryQuery(
      mockAudioFilesService,
      mockS3Service,
      mockConfigService,
    );
  });

  it('maps rows to the wire shape with a presigned url and omits s3 fields', async () => {
    mockAudioFilesService.countAudioLibrary.mockResolvedValue(1);
    mockAudioFilesService.listAudioLibrary.mockResolvedValue([entry]);
    mockS3Service.generatePresignedGetUrl.mockResolvedValue('https://signed/one');

    const result = await query.execute({ page: 1, perPage: 20 });

    expect(mockS3Service.generatePresignedGetUrl).toHaveBeenCalledWith(
      'bucket',
      'audio/one.mp3',
      3600,
    );
    expect(result).toEqual({
      audios: [
        {
          audio_id: 'audio-1',
          source_type: 'article',
          source_id: 'article-1',
          title: 'An Article',
          source_label: 'Some Feed',
          published_at: '2026-07-30T00:00:00.000Z',
          audio: {
            duration_seconds: 90,
            file_size_bytes: 2048,
            presigned_url: 'https://signed/one',
            created_at: new Date('2026-08-01T10:00:00.000Z'),
          },
        },
      ],
      pagination: {
        page: 1,
        per_page: 20,
        total_pages: 1,
        total_audios: 1,
      },
    });
  });

  it('defaults to page 1 / perPage 20 and converts to limit/offset', async () => {
    mockAudioFilesService.countAudioLibrary.mockResolvedValue(0);
    mockAudioFilesService.listAudioLibrary.mockResolvedValue([]);

    await query.execute({});

    expect(mockAudioFilesService.listAudioLibrary).toHaveBeenCalledWith(20, 0);
  });

  it('computes offset from page and perPage', async () => {
    mockAudioFilesService.countAudioLibrary.mockResolvedValue(50);
    mockAudioFilesService.listAudioLibrary.mockResolvedValue([]);

    await query.execute({ page: 3, perPage: 15 });

    expect(mockAudioFilesService.listAudioLibrary).toHaveBeenCalledWith(15, 30);
  });

  it('coerces string query params to numbers (query strings arrive as strings)', async () => {
    mockAudioFilesService.countAudioLibrary.mockResolvedValue(0);
    mockAudioFilesService.listAudioLibrary.mockResolvedValue([]);

    await query.execute({
      page: '2' as unknown as number,
      perPage: '10' as unknown as number,
    });

    expect(mockAudioFilesService.listAudioLibrary).toHaveBeenCalledWith(10, 10);
  });

  it('clamps perPage to the maximum of 100', async () => {
    mockAudioFilesService.countAudioLibrary.mockResolvedValue(0);
    mockAudioFilesService.listAudioLibrary.mockResolvedValue([]);

    await query.execute({ page: 1, perPage: 10000000 });

    expect(mockAudioFilesService.listAudioLibrary).toHaveBeenCalledWith(100, 0);
  });

  it('computes total_pages by ceiling division', async () => {
    mockAudioFilesService.countAudioLibrary.mockResolvedValue(41);
    mockAudioFilesService.listAudioLibrary.mockResolvedValue([]);

    const result = await query.execute({ page: 1, perPage: 20 });

    expect(result.pagination.total_pages).toBe(3);
  });
});
