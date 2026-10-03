import { Test, TestingModule } from '@nestjs/testing';
import { Job, Queue } from 'bullmq';
import { mock, mockReset } from 'jest-mock-extended';
import {
  ARTICLE_PROCESSING_QUEUE,
  CUSTOM_BRIEFING_GENERATION_QUEUE,
  INGEST_TRANSCRIPT_JOB,
  TRANSCRIPT_BACKUP_QUEUE,
  YOUTUBE_TRANSCRIPT_INGEST_QUEUE,
  YOUTUBE_TRANSCRIPTION_SUMMARY_QUEUE,
} from './constants/queue.constants';
import { QueueService } from './queue.service';

jest.mock('bullmq');

describe('QueueService', () => {
  let service: QueueService;
  const mockArticleQueue = mock<Queue>();
  const mockTranscriptionSummaryQueue = mock<Queue>();
  const mockCustomBriefingQueue = mock<Queue>();
  const mockIngestQueue = mock<Queue>();
  const mockTranscriptBackupQueue = mock<Queue>();

  beforeEach(async () => {
    mockReset(mockArticleQueue);
    mockReset(mockTranscriptionSummaryQueue);
    mockReset(mockCustomBriefingQueue);
    mockReset(mockIngestQueue);
    mockReset(mockTranscriptBackupQueue);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        {
          provide: ARTICLE_PROCESSING_QUEUE,
          useValue: mockArticleQueue,
        },
        {
          provide: YOUTUBE_TRANSCRIPTION_SUMMARY_QUEUE,
          useValue: mockTranscriptionSummaryQueue,
        },
        {
          provide: CUSTOM_BRIEFING_GENERATION_QUEUE,
          useValue: mockCustomBriefingQueue,
        },
        {
          provide: YOUTUBE_TRANSCRIPT_INGEST_QUEUE,
          useValue: mockIngestQueue,
        },
        {
          provide: TRANSCRIPT_BACKUP_QUEUE,
          useValue: mockTranscriptBackupQueue,
        },
      ],
    }).compile();

    service = module.get<QueueService>(QueueService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addTranscriptBackupJob', () => {
    it('enqueues a backup job with the file path and channel id', async () => {
      mockTranscriptBackupQueue.add.mockResolvedValue({ id: 'backup-1' } as Job);

      const result = await service.addTranscriptBackupJob({
        filePath: 'transcripts/UC123_20260816_120000.json',
        channelId: 'UC123',
      });

      expect(mockTranscriptBackupQueue.add).toHaveBeenCalledWith(
        'backup-transcript',
        {
          filePath: 'transcripts/UC123_20260816_120000.json',
          channelId: 'UC123',
        },
      );
      expect(result).toEqual({ jobId: 'backup-1' });
    });
  });

  describe('addTranscriptIngestJob', () => {
    it('enqueues with a deterministic job id built from channel and video', async () => {
      mockIngestQueue.add.mockResolvedValue({ id: 'channel-1__abc123' } as never);

      const jobId = await service.addTranscriptIngestJob(
        {
          videoUrl: 'https://www.youtube.com/watch?v=abc123',
          channelDbId: 'channel-1',
          customPrompt: 'Focus on architecture',
          generateAudio: true,
        },
        'abc123',
      );

      expect(jobId).toBe('channel-1__abc123');
      expect(mockIngestQueue.add).toHaveBeenCalledWith(
        INGEST_TRANSCRIPT_JOB,
        {
          videoUrl: 'https://www.youtube.com/watch?v=abc123',
          channelDbId: 'channel-1',
          customPrompt: 'Focus on architecture',
          generateAudio: true,
        },
        { jobId: 'channel-1__abc123' },
      );
    });

    // BullMQ rejects a custom job id containing `:`, and these tests mock the
    // queue, so nothing else here would catch the separator regressing.
    it('builds a job id BullMQ accepts as a custom id', async () => {
      mockIngestQueue.add.mockResolvedValue({ id: 'ignored' } as never);

      await service.addTranscriptIngestJob(
        {
          videoUrl: 'https://www.youtube.com/watch?v=abc123',
          channelDbId: 'a6e4b670-1c3e-4bca-b857-4527a9335593',
        },
        'abc123',
      );

      const [, , options] = mockIngestQueue.add.mock.calls[0] as [
        string,
        unknown,
        { jobId: string },
      ];
      expect(options.jobId).not.toContain(':');
    });

    it('leaves no existing job untouched and enqueues as usual', async () => {
      mockIngestQueue.getJob.mockResolvedValue(undefined as never);
      mockIngestQueue.add.mockResolvedValue({ id: 'channel-1__abc123' } as never);

      const jobId = await service.addTranscriptIngestJob(
        { videoUrl: 'https://www.youtube.com/watch?v=abc123', channelDbId: 'channel-1' },
        'abc123',
      );

      expect(jobId).toBe('channel-1__abc123');
      expect(mockIngestQueue.add).toHaveBeenCalledTimes(1);
    });

    // Re-pasting a failed URL is the documented retry path, so the stale
    // failed key has to be cleared or BullMQ would drop the new job.
    it('clears a failed job of the same id before enqueueing the retry', async () => {
      const failedJob = mock<Job>();
      failedJob.isFailed.mockResolvedValue(true);
      mockIngestQueue.getJob.mockResolvedValue(failedJob as never);
      mockIngestQueue.add.mockResolvedValue({ id: 'channel-1__abc123' } as never);

      const jobId = await service.addTranscriptIngestJob(
        { videoUrl: 'https://www.youtube.com/watch?v=abc123', channelDbId: 'channel-1' },
        'abc123',
      );

      expect(failedJob.remove).toHaveBeenCalledTimes(1);
      expect(jobId).toBe('channel-1__abc123');
      expect(mockIngestQueue.add).toHaveBeenCalledTimes(1);
    });

    // A waiting, active or delayed job of the same id is a live duplicate:
    // dropping it is the intended behavior, so it must survive.
    it('leaves a live job of the same id alone', async () => {
      const liveJob = mock<Job>();
      liveJob.isFailed.mockResolvedValue(false);
      mockIngestQueue.getJob.mockResolvedValue(liveJob as never);
      mockIngestQueue.add.mockResolvedValue({ id: 'channel-1__abc123' } as never);

      await service.addTranscriptIngestJob(
        { videoUrl: 'https://www.youtube.com/watch?v=abc123', channelDbId: 'channel-1' },
        'abc123',
      );

      expect(liveJob.remove).not.toHaveBeenCalled();
      expect(mockIngestQueue.add).toHaveBeenCalledTimes(1);
    });
  });
});
