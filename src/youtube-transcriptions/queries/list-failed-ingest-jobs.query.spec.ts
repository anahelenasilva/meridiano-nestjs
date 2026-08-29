import { IngestTranscriptJobData } from '@libs/queue';
import { Job, Queue } from 'bullmq';
import { mock, mockReset } from 'jest-mock-extended';
import { YoutubeChannelsService } from '../../youtube-channels/youtube-channels.service';
import { ListFailedIngestJobsQuery } from './list-failed-ingest-jobs.query';

function fakeJob(
  id: string,
  data: IngestTranscriptJobData,
  failedReason: string,
): Job<IngestTranscriptJobData> {
  return { id, data, failedReason } as Job<IngestTranscriptJobData>;
}

describe('ListFailedIngestJobsQuery', () => {
  const mockQueue = mock<Queue>();
  const mockChannels = mock<YoutubeChannelsService>();
  let query: ListFailedIngestJobsQuery;

  beforeEach(() => {
    mockReset(mockQueue);
    mockReset(mockChannels);
    query = new ListFailedIngestJobsQuery(mockQueue, mockChannels);
  });

  it('reads only failed jobs', async () => {
    mockQueue.getJobs.mockResolvedValue([]);

    await query.execute();

    expect(mockQueue.getJobs).toHaveBeenCalledWith(['failed']);
  });

  it('resolves each distinct channel name once', async () => {
    mockQueue.getJobs.mockResolvedValue([
      fakeJob('channel-1:aaa', {
        videoUrl: 'https://www.youtube.com/watch?v=aaa',
        channelDbId: 'channel-1',
      }, 'No transcript available'),
      fakeJob('channel-1:bbb', {
        videoUrl: 'https://www.youtube.com/watch?v=bbb',
        channelDbId: 'channel-1',
      }, 'No transcript available'),
    ] as never);
    mockChannels.getChannelById.mockResolvedValue({
      id: 'channel-1',
      name: 'Test Channel',
      enabled: true,
    } as never);

    const jobs = await query.execute();

    expect(mockChannels.getChannelById).toHaveBeenCalledTimes(1);
    expect(jobs).toEqual([
      {
        jobId: 'channel-1:aaa',
        videoUrl: 'https://www.youtube.com/watch?v=aaa',
        channelName: 'Test Channel',
        reason: 'No transcript available',
      },
      {
        jobId: 'channel-1:bbb',
        videoUrl: 'https://www.youtube.com/watch?v=bbb',
        channelName: 'Test Channel',
        reason: 'No transcript available',
      },
    ]);
  });

  it('falls back to a placeholder name when the channel is gone', async () => {
    mockQueue.getJobs.mockResolvedValue([
      fakeJob('channel-x:aaa', {
        videoUrl: 'https://www.youtube.com/watch?v=aaa',
        channelDbId: 'channel-x',
      }, 'boom'),
    ] as never);
    mockChannels.getChannelById.mockResolvedValue(null);

    const jobs = await query.execute();

    expect(jobs[0].channelName).toBe('Unknown channel');
  });

  it('returns an empty list when the queue read throws', async () => {
    mockQueue.getJobs.mockRejectedValue(new Error('redis down'));

    await expect(query.execute()).resolves.toEqual([]);
  });
});
