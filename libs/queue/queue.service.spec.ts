import { EmailService } from '@libs/email';
import { RedisService } from '@libs/redis';
import { Test, TestingModule } from '@nestjs/testing';
import { Job, Queue } from 'bullmq';
import Redis from 'ioredis';
import { mock, mockReset } from 'jest-mock-extended';
import { ConfigService } from '../../src/config/config.service';
import { FeedProfile } from '../../src/shared/types/feed';
import {
  ARTICLE_PROCESSING_QUEUE,
  AUDIO_GENERATION_QUEUE,
  CUSTOM_BRIEFING_GENERATION_QUEUE,
  INGEST_TRANSCRIPT_JOB,
  MARKDOWN_ARTICLE_PROCESSING_QUEUE,
  TRANSCRIPT_BACKUP_QUEUE,
  YOUTUBE_TRANSCRIPT_INGEST_QUEUE,
  YOUTUBE_TRANSCRIPTION_SUMMARY_QUEUE,
} from './constants/queue.constants';
import { QueueService } from './queue.service';

jest.mock('bullmq');

describe('QueueService', () => {
  let service: QueueService;
  const mockArticleQueue = mock<Queue>();
  const mockMarkdownArticleQueue = mock<Queue>();
  const mockTranscriptionSummaryQueue = mock<Queue>();
  const mockAudioQueue = mock<Queue>();
  const mockCustomBriefingQueue = mock<Queue>();
  const mockIngestQueue = mock<Queue>();
  const mockTranscriptBackupQueue = mock<Queue>();
  const mockConfigService = mock<ConfigService>();
  const mockEmailService = mock<EmailService>();
  const mockRedisService = mock<RedisService>();
  const mockRedisClient = mock<Redis>();

  beforeEach(async () => {
    mockReset(mockArticleQueue);
    mockReset(mockMarkdownArticleQueue);
    mockReset(mockTranscriptionSummaryQueue);
    mockReset(mockAudioQueue);
    mockReset(mockCustomBriefingQueue);
    mockReset(mockIngestQueue);
    mockReset(mockTranscriptBackupQueue);
    mockReset(mockConfigService);
    mockReset(mockEmailService);
    mockReset(mockRedisService);
    mockReset(mockRedisClient);

    mockRedisService.getClient.mockReturnValue(mockRedisClient);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        {
          provide: ARTICLE_PROCESSING_QUEUE,
          useValue: mockArticleQueue,
        },
        {
          provide: MARKDOWN_ARTICLE_PROCESSING_QUEUE,
          useValue: mockMarkdownArticleQueue,
        },
        {
          provide: YOUTUBE_TRANSCRIPTION_SUMMARY_QUEUE,
          useValue: mockTranscriptionSummaryQueue,
        },
        {
          provide: AUDIO_GENERATION_QUEUE,
          useValue: mockAudioQueue,
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
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
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

  describe('addCustomBriefingJob', () => {
    it('adds retry options from custom briefing queue config', async () => {
      mockConfigService.getCustomBriefingQueueConfig.mockReturnValue({
        concurrency: 2,
        attempts: 4,
        backoffDelayMs: 7000,
      });
      mockCustomBriefingQueue.add.mockResolvedValue({ id: 'job-123' } as Job);

      const result = await service.addCustomBriefingJob({
        articleIds: ['article-1', 'article-2'],
        feedProfile: FeedProfile.DEFAULT,
        customPrompt: 'Focus on risks',
      });

      expect(mockCustomBriefingQueue.add).toHaveBeenCalledWith(
        'generate-custom-briefing',
        {
          articleIds: ['article-1', 'article-2'],
          feedProfile: FeedProfile.DEFAULT,
          customPrompt: 'Focus on risks',
        },
        {
          attempts: 4,
          backoff: {
            type: 'exponential',
            delay: 7000,
          },
        },
      );
      expect(result).toEqual({ jobId: 'job-123' });
    });
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
      mockIngestQueue.add.mockResolvedValue({ id: 'channel-1:abc123' } as never);

      const jobId = await service.addTranscriptIngestJob(
        {
          videoUrl: 'https://www.youtube.com/watch?v=abc123',
          channelDbId: 'channel-1',
          customPrompt: 'Focus on architecture',
          generateAudio: true,
        },
        'abc123',
      );

      expect(jobId).toBe('channel-1:abc123');
      expect(mockIngestQueue.add).toHaveBeenCalledWith(
        INGEST_TRANSCRIPT_JOB,
        {
          videoUrl: 'https://www.youtube.com/watch?v=abc123',
          channelDbId: 'channel-1',
          customPrompt: 'Focus on architecture',
          generateAudio: true,
        },
        { jobId: 'channel-1:abc123' },
      );
    });

    it('leaves no existing job untouched and enqueues as usual', async () => {
      mockIngestQueue.getJob.mockResolvedValue(undefined as never);
      mockIngestQueue.add.mockResolvedValue({ id: 'channel-1:abc123' } as never);

      const jobId = await service.addTranscriptIngestJob(
        { videoUrl: 'https://www.youtube.com/watch?v=abc123', channelDbId: 'channel-1' },
        'abc123',
      );

      expect(jobId).toBe('channel-1:abc123');
      expect(mockIngestQueue.add).toHaveBeenCalledTimes(1);
    });

    // Re-pasting a failed URL is the documented retry path, so the stale
    // failed key has to be cleared or BullMQ would drop the new job.
    it('clears a failed job of the same id before enqueueing the retry', async () => {
      const failedJob = mock<Job>();
      failedJob.isFailed.mockResolvedValue(true);
      mockIngestQueue.getJob.mockResolvedValue(failedJob as never);
      mockIngestQueue.add.mockResolvedValue({ id: 'channel-1:abc123' } as never);

      const jobId = await service.addTranscriptIngestJob(
        { videoUrl: 'https://www.youtube.com/watch?v=abc123', channelDbId: 'channel-1' },
        'abc123',
      );

      expect(failedJob.remove).toHaveBeenCalledTimes(1);
      expect(jobId).toBe('channel-1:abc123');
      expect(mockIngestQueue.add).toHaveBeenCalledTimes(1);
    });

    // A waiting, active or delayed job of the same id is a live duplicate:
    // dropping it is the intended behavior, so it must survive.
    it('leaves a live job of the same id alone', async () => {
      const liveJob = mock<Job>();
      liveJob.isFailed.mockResolvedValue(false);
      mockIngestQueue.getJob.mockResolvedValue(liveJob as never);
      mockIngestQueue.add.mockResolvedValue({ id: 'channel-1:abc123' } as never);

      await service.addTranscriptIngestJob(
        { videoUrl: 'https://www.youtube.com/watch?v=abc123', channelDbId: 'channel-1' },
        'abc123',
      );

      expect(liveJob.remove).not.toHaveBeenCalled();
      expect(mockIngestQueue.add).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleAudioGenerationFailure', () => {
    const handleAudioFailure = (jobId: string, failedReason: string) =>
      (service as unknown as { handleAudioGenerationFailure: (j: string, r: string) => Promise<void> })
        .handleAudioGenerationFailure(jobId, failedReason);

    it('should send email when job exhausted retries and config is set', async () => {
      const mockJob = {
        id: 'job-123',
        attemptsMade: 3,
        opts: { attempts: 3 },
        data: { sourceType: 'transcription', sourceId: 'trans-id-1', text: 'x', date: new Date() },
      } as unknown as Job;
      mockAudioQueue.getJob.mockResolvedValue(mockJob);
      mockConfigService.getAudioFailureNotificationEmail.mockReturnValue({
        to: 'support@example.com',
        from: 'noreply@example.com',
      });
      mockEmailService.sendEmail.mockResolvedValue({ success: true });

      await handleAudioFailure('job-123', 'Test failure reason');

      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'support@example.com',
          from: 'noreply@example.com',
          subject: 'Audio Generation Failed',
          text: expect.stringContaining('job-123'),
        }),
      );
      expect(mockEmailService.sendEmail.mock.calls[0][0].text).toContain('transcription');
      expect(mockEmailService.sendEmail.mock.calls[0][0].text).toContain('trans-id-1');
      expect(mockEmailService.sendEmail.mock.calls[0][0].text).toContain('Test failure reason');
    });

    it('should not send email when config is missing', async () => {
      const mockJob = {
        id: 'job-456',
        attemptsMade: 3,
        opts: { attempts: 3 },
        data: { sourceType: 'article', sourceId: 'art-id-1', text: 'x', date: new Date() },
      } as unknown as Job;
      mockAudioQueue.getJob.mockResolvedValue(mockJob);
      mockConfigService.getAudioFailureNotificationEmail.mockReturnValue(null);

      await handleAudioFailure('job-456', 'Some error');

      expect(mockEmailService.sendEmail).not.toHaveBeenCalled();
    });

    it('should not send email when job has not exhausted retries', async () => {
      const mockJob = {
        id: 'job-789',
        attemptsMade: 1,
        opts: { attempts: 3 },
        data: { sourceType: 'transcription', sourceId: 'trans-id-2', text: 'x', date: new Date() },
      } as unknown as Job;
      mockAudioQueue.getJob.mockResolvedValue(mockJob);
      mockConfigService.getAudioFailureNotificationEmail.mockReturnValue({
        to: 'support@example.com',
        from: 'noreply@example.com',
      });

      await handleAudioFailure('job-789', 'Retryable error');

      expect(mockEmailService.sendEmail).not.toHaveBeenCalled();
    });

    it('should not throw when email send fails', async () => {
      const mockJob = {
        id: 'job-999',
        attemptsMade: 3,
        opts: { attempts: 3 },
        data: { sourceType: 'article', sourceId: 'art-id-2', text: 'x', date: new Date() },
      } as unknown as Job;
      mockAudioQueue.getJob.mockResolvedValue(mockJob);
      mockConfigService.getAudioFailureNotificationEmail.mockReturnValue({
        to: 'support@example.com',
        from: 'noreply@example.com',
      });
      mockEmailService.sendEmail.mockRejectedValue(new Error('Mailgun timeout'));

      await expect(handleAudioFailure('job-999', 'Failure')).resolves.not.toThrow();
    });

    it('should not throw when job is not found', async () => {
      mockAudioQueue.getJob.mockResolvedValue(undefined);

      await expect(handleAudioFailure('missing-job', 'Error')).resolves.not.toThrow();
    });
  });
});
