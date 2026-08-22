import { AudioJobService, type AudioJobDescriptor } from '@libs/audio';
import { mock } from 'jest-mock-extended';
import { AudioController } from './audio-files.controller';
import { ListAudioLibraryQuery } from './queries/list-audio-library.query';

describe('AudioController', () => {
  const mockListAudioLibraryQuery = mock<ListAudioLibraryQuery>();
  const mockAudioJobService = mock<AudioJobService>();
  let controller: AudioController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AudioController(
      mockListAudioLibraryQuery,
      mockAudioJobService,
    );
  });

  it('passes page and perPage through to the query and returns its result', async () => {
    const response = {
      audios: [],
      pagination: { page: 2, per_page: 10, total_pages: 0, total_audios: 0 },
    };
    mockListAudioLibraryQuery.execute.mockResolvedValue(response);

    const result = await controller.listAudio({ page: 2, perPage: 10 });

    expect(mockListAudioLibraryQuery.execute).toHaveBeenCalledWith({
      page: 2,
      perPage: 10,
    });
    expect(result).toBe(response);
  });

  it('wraps the job service result in a jobs envelope', async () => {
    const descriptors: AudioJobDescriptor[] = [
      { source_type: 'article', source_id: 'a-1', state: 'queued', error: null },
    ];
    mockAudioJobService.listActiveAndFailedJobs.mockResolvedValue(descriptors);

    const result = await controller.listJobs();

    expect(result).toEqual({ jobs: descriptors });
  });
});
