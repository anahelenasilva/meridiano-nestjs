import { RedisService } from '@libs/redis';
import { Job } from 'bullmq';
import { mock, mockReset } from 'jest-mock-extended';
import { IngestTranscriptJobData } from '@libs/queue';
import { YoutubeTranscriptionsService } from '../services/youtube-transcriptions.service';
import { YoutubeTranscriptIngestProcessor } from './youtube-transcript-ingest.processor';

describe('YoutubeTranscriptIngestProcessor', () => {
  const mockRedisService = mock<RedisService>();
  const mockService = mock<YoutubeTranscriptionsService>();
  let processor: YoutubeTranscriptIngestProcessor;

  beforeEach(() => {
    mockReset(mockRedisService);
    mockReset(mockService);
    processor = new YoutubeTranscriptIngestProcessor(
      mockRedisService,
      mockService,
    );
  });

  function fakeJob(data: IngestTranscriptJobData): Job<IngestTranscriptJobData> {
    return { id: 'channel-1:abc123', data } as Job<IngestTranscriptJobData>;
  }

  it('delegates to processSingleVideoUrl with the job payload', async () => {
    mockService.processSingleVideoUrl.mockResolvedValue('transcription-1');

    const result = await processor.ingestTranscript(
      fakeJob({
        videoUrl: 'https://www.youtube.com/watch?v=abc123',
        channelDbId: 'channel-1',
        customPrompt: 'Focus on architecture',
        generateAudio: true,
      }),
    );

    expect(mockService.processSingleVideoUrl).toHaveBeenCalledWith(
      'https://www.youtube.com/watch?v=abc123',
      'channel-1',
      undefined,
      'Focus on architecture',
      true,
    );
    expect(result).toEqual({ success: true, transcriptionId: 'transcription-1' });
  });

  it('reports a duplicate as success with no transcription id', async () => {
    mockService.processSingleVideoUrl.mockResolvedValue(null);

    const result = await processor.ingestTranscript(
      fakeJob({
        videoUrl: 'https://www.youtube.com/watch?v=abc123',
        channelDbId: 'channel-1',
      }),
    );

    expect(result).toEqual({ success: true, transcriptionId: null });
  });

  it('rethrows so BullMQ retries the job', async () => {
    mockService.processSingleVideoUrl.mockRejectedValue(
      new Error('No transcript available'),
    );

    await expect(
      processor.ingestTranscript(
        fakeJob({
          videoUrl: 'https://www.youtube.com/watch?v=abc123',
          channelDbId: 'channel-1',
        }),
      ),
    ).rejects.toThrow('No transcript available');
  });
});
