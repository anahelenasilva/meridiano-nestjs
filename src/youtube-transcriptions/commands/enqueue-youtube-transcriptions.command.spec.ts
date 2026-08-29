import { QueueService } from '@libs/queue';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { mock, mockReset } from 'jest-mock-extended';
import { YoutubeChannelsService } from '../../youtube-channels/youtube-channels.service';
import { YoutubeTranscriptionsService } from '../services/youtube-transcriptions.service';
import { EnqueueYoutubeTranscriptionsCommand } from './enqueue-youtube-transcriptions.command';

describe('EnqueueYoutubeTranscriptionsCommand', () => {
  const mockChannels = mock<YoutubeChannelsService>();
  const mockTranscriptions = mock<YoutubeTranscriptionsService>();
  const mockQueue = mock<QueueService>();
  let command: EnqueueYoutubeTranscriptionsCommand;

  const enabledChannel = {
    id: 'channel-1',
    channelId: 'UC-test',
    name: 'Test Channel',
    url: 'https://youtube.com/@test',
    description: '',
    enabled: true,
  };

  beforeEach(() => {
    mockReset(mockChannels);
    mockReset(mockTranscriptions);
    mockReset(mockQueue);
    command = new EnqueueYoutubeTranscriptionsCommand(
      mockChannels,
      mockTranscriptions,
      mockQueue,
    );
  });

  it('resolves the channel once for the whole batch', async () => {
    mockChannels.getChannelById.mockResolvedValue(enabledChannel as never);
    mockTranscriptions.findExistingVideoUrls.mockResolvedValue(new Set());
    mockQueue.addTranscriptIngestJob.mockResolvedValue('job-1');

    await command.execute({
      urls: [
        'https://www.youtube.com/watch?v=aaa',
        'https://youtu.be/bbb',
      ],
      channelDbId: 'channel-1',
    });

    expect(mockChannels.getChannelById).toHaveBeenCalledTimes(1);
  });

  it('splits the batch into accepted, skipped and rejected', async () => {
    mockChannels.getChannelById.mockResolvedValue(enabledChannel as never);
    mockTranscriptions.findExistingVideoUrls.mockResolvedValue(
      new Set(['https://www.youtube.com/watch?v=bbb']),
    );
    mockQueue.addTranscriptIngestJob.mockResolvedValue('job-1');

    const result = await command.execute({
      urls: [
        'https://www.youtube.com/watch?v=aaa',
        'https://youtu.be/bbb',
        'https://example.com/not-youtube',
      ],
      channelDbId: 'channel-1',
    });

    expect(result.accepted).toEqual(['https://www.youtube.com/watch?v=aaa']);
    expect(result.skipped).toEqual(['https://www.youtube.com/watch?v=bbb']);
    expect(result.rejected).toEqual([
      {
        url: 'https://example.com/not-youtube',
        reason: 'Not a recognizable YouTube video URL',
      },
    ]);
  });

  it('normalizes urls before the duplicate lookup', async () => {
    mockChannels.getChannelById.mockResolvedValue(enabledChannel as never);
    mockTranscriptions.findExistingVideoUrls.mockResolvedValue(new Set());
    mockQueue.addTranscriptIngestJob.mockResolvedValue('job-1');

    await command.execute({
      urls: ['https://youtu.be/aaa'],
      channelDbId: 'channel-1',
    });

    expect(mockTranscriptions.findExistingVideoUrls).toHaveBeenCalledWith([
      'https://www.youtube.com/watch?v=aaa',
    ]);
  });

  it('drops duplicates inside the payload itself', async () => {
    mockChannels.getChannelById.mockResolvedValue(enabledChannel as never);
    mockTranscriptions.findExistingVideoUrls.mockResolvedValue(new Set());
    mockQueue.addTranscriptIngestJob.mockResolvedValue('job-1');

    const result = await command.execute({
      urls: ['https://youtu.be/aaa', 'https://www.youtube.com/watch?v=aaa'],
      channelDbId: 'channel-1',
    });

    expect(result.accepted).toEqual(['https://www.youtube.com/watch?v=aaa']);
    expect(mockQueue.addTranscriptIngestJob).toHaveBeenCalledTimes(1);
  });

  it('accepts a schemeless youtube url', async () => {
    mockChannels.getChannelById.mockResolvedValue(enabledChannel as never);
    mockTranscriptions.findExistingVideoUrls.mockResolvedValue(new Set());
    mockQueue.addTranscriptIngestJob.mockResolvedValue('job-1');

    const result = await command.execute({
      urls: ['youtube.com/watch?v=aaa'],
      channelDbId: 'channel-1',
    });

    expect(result.accepted).toEqual(['https://www.youtube.com/watch?v=aaa']);
    expect(result.rejected).toEqual([]);
  });

  it('enqueues with the video id and the batch options', async () => {
    mockChannels.getChannelById.mockResolvedValue(enabledChannel as never);
    mockTranscriptions.findExistingVideoUrls.mockResolvedValue(new Set());
    mockQueue.addTranscriptIngestJob.mockResolvedValue('job-1');

    await command.execute({
      urls: ['https://www.youtube.com/watch?v=aaa'],
      channelDbId: 'channel-1',
      customPrompt: 'Focus on architecture',
      generateAudio: true,
    });

    expect(mockQueue.addTranscriptIngestJob).toHaveBeenCalledWith(
      {
        videoUrl: 'https://www.youtube.com/watch?v=aaa',
        channelDbId: 'channel-1',
        customPrompt: 'Focus on architecture',
        generateAudio: true,
      },
      'aaa',
    );
  });

  it('throws NotFound when the channel does not exist', async () => {
    mockChannels.getChannelById.mockResolvedValue(null);

    await expect(
      command.execute({
        urls: ['https://www.youtube.com/watch?v=aaa'],
        channelDbId: 'missing',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws BadRequest when the channel is disabled', async () => {
    mockChannels.getChannelById.mockResolvedValue({
      ...enabledChannel,
      enabled: false,
    } as never);

    await expect(
      command.execute({
        urls: ['https://www.youtube.com/watch?v=aaa'],
        channelDbId: 'channel-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
