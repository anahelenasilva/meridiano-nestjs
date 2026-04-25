import { EmailService } from '@libs/email';
import { RedisService } from '@libs/redis';
import { Test, TestingModule } from '@nestjs/testing';
import { Job, Queue } from 'bullmq';
import Redis from 'ioredis';
import { mock, mockReset } from 'jest-mock-extended';
import { ConfigService } from '../../src/config/config.service';
import {
  ARTICLE_PROCESSING_QUEUE,
  AUDIO_GENERATION_QUEUE,
  CUSTOM_BRIEFING_GENERATION_QUEUE,
  MARKDOWN_ARTICLE_PROCESSING_QUEUE,
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
