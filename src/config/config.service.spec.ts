import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { YoutubeChannelsService } from '../youtube-channels/youtube-channels.service';
import { ConfigService } from './config.service';

describe('ConfigService', () => {
  let service: ConfigService;
  const mockYoutubeChannelsService = mock<YoutubeChannelsService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfigService,
        {
          provide: YoutubeChannelsService,
          useValue: mockYoutubeChannelsService,
        },
      ],
    }).compile();

    service = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('formatPrompt', () => {
    it('should replace both {article_content} and {article_title} placeholders', () => {
      const template = '## Title\n- {article_title}\n\nContent:\n{article_content}';
      const result = service.formatPrompt(template, {
        article_content: 'Some article text',
        article_title: 'My Article Title',
      });

      expect(result).toBe('## Title\n- My Article Title\n\nContent:\nSome article text');
      expect(result).not.toContain('{article_title}');
      expect(result).not.toContain('{article_content}');
    });

    it('should replace {article_title} with empty string when value is explicitly undefined', () => {
      const template = '## Title\n- {article_title}\n\nContent:\n{article_content}';
      const result = service.formatPrompt(template, {
        article_content: 'Some text',
        article_title: undefined,
      });

      expect(result).toContain('## Title\n- \n');
    });

    it('should handle templates without {article_title} placeholder', () => {
      const template = 'Content:\n{article_content}';
      const result = service.formatPrompt(template, {
        article_content: 'Some text',
        article_title: 'Title',
      });

      expect(result).toBe('Content:\nSome text');
    });
  });

  describe('getArticleEmailsNotifications', () => {
    it('should return email from environment variable when set', () => {
      process.env.ARTICLE_FAILURE_NOTIFICATION_EMAIL = 'test@example.com';
      process.env.ARTICLE_FAILURE_NOTIFICATION_EMAIL_FROM = 'test@example.com';

      const result = service.getArticleEmailsNotifications();

      expect(result).toEqual({
        failureNotificationEmail: 'test@example.com',
        failureNotificationEmailFrom: 'test@example.com',
      });

      delete process.env.ARTICLE_FAILURE_NOTIFICATION_EMAIL;
      delete process.env.ARTICLE_FAILURE_NOTIFICATION_EMAIL_FROM;
    });

    it('should return empty string when environment variable is not set', () => {
      delete process.env.ARTICLE_FAILURE_NOTIFICATION_EMAIL;
      delete process.env.ARTICLE_FAILURE_NOTIFICATION_EMAIL_FROM;

      const result = service.getArticleEmailsNotifications();

      expect(result).toEqual({
        failureNotificationEmail: '',
        failureNotificationEmailFrom: '',
      });
    });

    it('should return empty string when environment variable is empty', () => {
      process.env.ARTICLE_FAILURE_NOTIFICATION_EMAIL = '';
      process.env.ARTICLE_FAILURE_NOTIFICATION_EMAIL_FROM = '';

      const result = service.getArticleEmailsNotifications();

      expect(result).toEqual({
        failureNotificationEmail: '',
        failureNotificationEmailFrom: '',
      });

      delete process.env.ARTICLE_FAILURE_NOTIFICATION_EMAIL;
      delete process.env.ARTICLE_FAILURE_NOTIFICATION_EMAIL_FROM;
    });
  });

  describe('getAudioFailureNotificationEmail', () => {
    it('should return config when both to and from are set', () => {
      process.env.AUDIO_FAILURE_SUPPORT_EMAIL = 'support@example.com';
      process.env.AUDIO_FAILURE_SUPPORT_EMAIL_FROM = 'noreply@example.com';

      const result = service.getAudioFailureNotificationEmail();

      expect(result).toEqual({ to: 'support@example.com', from: 'noreply@example.com' });

      delete process.env.AUDIO_FAILURE_SUPPORT_EMAIL;
      delete process.env.AUDIO_FAILURE_SUPPORT_EMAIL_FROM;
    });

    it('should fall back to ARTICLE_FAILURE_NOTIFICATION_EMAIL_FROM when AUDIO_FAILURE_SUPPORT_EMAIL_FROM is not set', () => {
      process.env.AUDIO_FAILURE_SUPPORT_EMAIL = 'support@example.com';
      process.env.ARTICLE_FAILURE_NOTIFICATION_EMAIL_FROM = 'article-from@example.com';

      const result = service.getAudioFailureNotificationEmail();

      expect(result).toEqual({ to: 'support@example.com', from: 'article-from@example.com' });

      delete process.env.AUDIO_FAILURE_SUPPORT_EMAIL;
      delete process.env.ARTICLE_FAILURE_NOTIFICATION_EMAIL_FROM;
    });

    it('should return null when AUDIO_FAILURE_SUPPORT_EMAIL is not set', () => {
      delete process.env.AUDIO_FAILURE_SUPPORT_EMAIL;
      delete process.env.AUDIO_FAILURE_SUPPORT_EMAIL_FROM;

      const result = service.getAudioFailureNotificationEmail();

      expect(result).toBeNull();
    });

    it('should return null when from is not configured', () => {
      process.env.AUDIO_FAILURE_SUPPORT_EMAIL = 'support@example.com';
      delete process.env.AUDIO_FAILURE_SUPPORT_EMAIL_FROM;
      delete process.env.ARTICLE_FAILURE_NOTIFICATION_EMAIL_FROM;

      const result = service.getAudioFailureNotificationEmail();

      expect(result).toBeNull();

      delete process.env.AUDIO_FAILURE_SUPPORT_EMAIL;
    });
  });

  describe('getEmbeddingFailureNotificationEmail', () => {
    it('should return config when both to and from are set', () => {
      process.env.EMBEDDING_FAILURE_NOTIFICATION_EMAIL = 'embedding@example.com';
      process.env.EMBEDDING_FAILURE_NOTIFICATION_EMAIL_FROM = 'noreply@example.com';

      const result = service.getEmbeddingFailureNotificationEmail();

      expect(result).toEqual({ to: 'embedding@example.com', from: 'noreply@example.com' });

      delete process.env.EMBEDDING_FAILURE_NOTIFICATION_EMAIL;
      delete process.env.EMBEDDING_FAILURE_NOTIFICATION_EMAIL_FROM;
    });

    it('should fall back to ARTICLE_FAILURE_NOTIFICATION_EMAIL_FROM when EMBEDDING_FAILURE_NOTIFICATION_EMAIL_FROM is not set', () => {
      process.env.EMBEDDING_FAILURE_NOTIFICATION_EMAIL = 'embedding@example.com';
      process.env.ARTICLE_FAILURE_NOTIFICATION_EMAIL_FROM = 'article-from@example.com';

      const result = service.getEmbeddingFailureNotificationEmail();

      expect(result).toEqual({ to: 'embedding@example.com', from: 'article-from@example.com' });

      delete process.env.EMBEDDING_FAILURE_NOTIFICATION_EMAIL;
      delete process.env.ARTICLE_FAILURE_NOTIFICATION_EMAIL_FROM;
    });

    it('should return null when EMBEDDING_FAILURE_NOTIFICATION_EMAIL is not set', () => {
      delete process.env.EMBEDDING_FAILURE_NOTIFICATION_EMAIL;
      delete process.env.EMBEDDING_FAILURE_NOTIFICATION_EMAIL_FROM;

      const result = service.getEmbeddingFailureNotificationEmail();

      expect(result).toBeNull();
    });

    it('should return null when from is not configured', () => {
      process.env.EMBEDDING_FAILURE_NOTIFICATION_EMAIL = 'embedding@example.com';
      delete process.env.EMBEDDING_FAILURE_NOTIFICATION_EMAIL_FROM;
      delete process.env.ARTICLE_FAILURE_NOTIFICATION_EMAIL_FROM;

      const result = service.getEmbeddingFailureNotificationEmail();

      expect(result).toBeNull();

      delete process.env.EMBEDDING_FAILURE_NOTIFICATION_EMAIL;
    });
  });

  describe('getPresignedUrlExpirySeconds', () => {
    it('should return 3600 when env var is not set', () => {
      delete process.env.PRESIGNED_URL_EXPIRY_SECONDS;

      const result = service.getPresignedUrlExpirySeconds();

      expect(result).toBe(3600);
    });

    it('should return env var value when set', () => {
      process.env.PRESIGNED_URL_EXPIRY_SECONDS = '7200';

      const result = service.getPresignedUrlExpirySeconds();

      expect(result).toBe(7200);

      delete process.env.PRESIGNED_URL_EXPIRY_SECONDS;
    });

    it('should return 3600 when env var is invalid', () => {
      process.env.PRESIGNED_URL_EXPIRY_SECONDS = 'invalid';

      const result = service.getPresignedUrlExpirySeconds();

      expect(result).toBe(3600);

      delete process.env.PRESIGNED_URL_EXPIRY_SECONDS;
    });

    it('should return 3600 when env var is zero', () => {
      process.env.PRESIGNED_URL_EXPIRY_SECONDS = '0';

      const result = service.getPresignedUrlExpirySeconds();

      expect(result).toBe(3600);

      delete process.env.PRESIGNED_URL_EXPIRY_SECONDS;
    });
  });

  describe('getArticleProcessingDelayMs', () => {
    afterEach(() => {
      delete process.env.ARTICLE_PROCESSING_DELAY_MS;
    });

    it('defaults to 1000 when env var is not set', () => {
      delete process.env.ARTICLE_PROCESSING_DELAY_MS;

      expect(service.getArticleProcessingDelayMs()).toBe(1000);
    });

    it('returns the env var value when set', () => {
      process.env.ARTICLE_PROCESSING_DELAY_MS = '250';

      expect(service.getArticleProcessingDelayMs()).toBe(250);
    });

    it('allows 0 to disable the delay', () => {
      process.env.ARTICLE_PROCESSING_DELAY_MS = '0';

      expect(service.getArticleProcessingDelayMs()).toBe(0);
    });

    it('falls back to 1000 when the env var is invalid', () => {
      process.env.ARTICLE_PROCESSING_DELAY_MS = 'nope';

      expect(service.getArticleProcessingDelayMs()).toBe(1000);
    });
  });

  describe('getCustomBriefingQueueConfig', () => {
    afterEach(() => {
      delete process.env.CUSTOM_BRIEFING_WORKER_CONCURRENCY;
      delete process.env.CUSTOM_BRIEFING_JOB_ATTEMPTS;
      delete process.env.CUSTOM_BRIEFING_JOB_BACKOFF_DELAY_MS;
    });

    it('returns defaults when custom briefing env vars are not set', () => {
      expect(service.getCustomBriefingQueueConfig()).toEqual({
        concurrency: 1,
        attempts: 3,
        backoffDelayMs: 5000,
      });
    });

    it('returns positive integer env values when set', () => {
      process.env.CUSTOM_BRIEFING_WORKER_CONCURRENCY = '4';
      process.env.CUSTOM_BRIEFING_JOB_ATTEMPTS = '5';
      process.env.CUSTOM_BRIEFING_JOB_BACKOFF_DELAY_MS = '10000';

      expect(service.getCustomBriefingQueueConfig()).toEqual({
        concurrency: 4,
        attempts: 5,
        backoffDelayMs: 10000,
      });
    });

    it('falls back to defaults for invalid env values', () => {
      process.env.CUSTOM_BRIEFING_WORKER_CONCURRENCY = 'invalid';
      process.env.CUSTOM_BRIEFING_JOB_ATTEMPTS = '0';
      process.env.CUSTOM_BRIEFING_JOB_BACKOFF_DELAY_MS = '-1';

      expect(service.getCustomBriefingQueueConfig()).toEqual({
        concurrency: 1,
        attempts: 3,
        backoffDelayMs: 5000,
      });
    });
  });

  describe('getNewsDigestConfig', () => {
    afterEach(() => {
      delete process.env.NEWS_DIGEST_PROMPT;
      delete process.env.NEWS_DIGEST_TO_EMAIL;
      delete process.env.NEWS_DIGEST_FROM_EMAIL;
    });

    it('returns env var values when all three are set', () => {
      process.env.NEWS_DIGEST_PROMPT = 'Focus on AI and cloud infrastructure';
      process.env.NEWS_DIGEST_TO_EMAIL = 'reader@example.com';
      process.env.NEWS_DIGEST_FROM_EMAIL = 'digest@mg.example.com';

      expect(service.getNewsDigestPrompt()).toBe('Focus on AI and cloud infrastructure');
      expect(service.getNewsDigestToEmail()).toBe('reader@example.com');
      expect(service.getNewsDigestFromEmail()).toBe('digest@mg.example.com');
    });

    it('returns empty string when env vars are not set', () => {
      expect(service.getNewsDigestPrompt()).toBe('');
      expect(service.getNewsDigestToEmail()).toBe('');
      expect(service.getNewsDigestFromEmail()).toBe('');
    });

    it('returns empty string when env vars are set to empty string', () => {
      process.env.NEWS_DIGEST_PROMPT = '';
      process.env.NEWS_DIGEST_TO_EMAIL = '';
      process.env.NEWS_DIGEST_FROM_EMAIL = '';

      expect(service.getNewsDigestPrompt()).toBe('');
      expect(service.getNewsDigestToEmail()).toBe('');
      expect(service.getNewsDigestFromEmail()).toBe('');
    });
  });

  describe('getEnabledChatModel', () => {
    it('should return environment variable value when ENABLED_CHAT_MODEL is set', () => {
      process.env.ENABLED_CHAT_MODEL = 'deepseek';

      const result = service.getEnabledChatModel();

      expect(result).toBe('deepseek');

      delete process.env.ENABLED_CHAT_MODEL;
    });

    it('should return config value when ENABLED_CHAT_MODEL env var is not set', () => {
      delete process.env.ENABLED_CHAT_MODEL;

      const result = service.getEnabledChatModel();

      expect(result).toBe('deepseek');
    });

    it('should throw error when neither env var nor config value is available', () => {
      delete process.env.ENABLED_CHAT_MODEL;

      // Temporarily override the config value to be empty
      const originalValue = (
        service as unknown as {
          CONFIGS: { models: { enabledChatModel: string } };
        }
      ).CONFIGS.models.enabledChatModel;
      (
        service as unknown as {
          CONFIGS: { models: { enabledChatModel: string } };
        }
      ).CONFIGS.models.enabledChatModel = '';

      expect(() => service.getEnabledChatModel()).toThrow(
        new BadRequestException(
          'No enabled chat model found in environment variables or config file',
        ),
      );

      // Restore original value
      (
        service as unknown as {
          CONFIGS: { models: { enabledChatModel: string } };
        }
      ).CONFIGS.models.enabledChatModel = originalValue;
    });
  });
});
