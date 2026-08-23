import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from './config.service';

describe('ConfigService', () => {
  let service: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ConfigService],
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
    });

    it('returns the prompt when it is set', () => {
      process.env.NEWS_DIGEST_PROMPT = 'Focus on AI and cloud infrastructure';

      expect(service.getNewsDigestPrompt()).toBe('Focus on AI and cloud infrastructure');
    });

    it('returns empty string when the prompt is not set', () => {
      expect(service.getNewsDigestPrompt()).toBe('');
    });

    it('returns empty string when the prompt is set to empty string', () => {
      process.env.NEWS_DIGEST_PROMPT = '';

      expect(service.getNewsDigestPrompt()).toBe('');
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

  describe('getCorsOrigins', () => {
    afterEach(() => {
      delete process.env.CORS_ORIGINS;
    });

    it('returns undefined when CORS_ORIGINS is not set', () => {
      delete process.env.CORS_ORIGINS;

      expect(service.getCorsOrigins()).toBeUndefined();
    });

    it('splits and trims a comma-separated list of origins', () => {
      process.env.CORS_ORIGINS = 'https://a.com, https://b.com';

      expect(service.getCorsOrigins()).toEqual([
        'https://a.com',
        'https://b.com',
      ]);
    });
  });

  describe('getPort', () => {
    afterEach(() => {
      delete process.env.PORT;
    });

    it('defaults to 3001 when PORT is not set', () => {
      delete process.env.PORT;

      expect(service.getPort()).toBe(3001);
    });

    it('returns the parsed PORT value when set', () => {
      process.env.PORT = '4000';

      expect(service.getPort()).toBe(4000);
    });

    it('falls back to 3001 when PORT is invalid', () => {
      process.env.PORT = 'nope';

      expect(service.getPort()).toBe(3001);
    });
  });

  describe('getS3ArticlesBucketName', () => {
    afterEach(() => {
      delete process.env.S3_ARTICLES_BUCKET_NAME;
    });

    it('returns undefined when not set', () => {
      delete process.env.S3_ARTICLES_BUCKET_NAME;

      expect(service.getS3ArticlesBucketName()).toBeUndefined();
    });

    it('returns the configured bucket name', () => {
      process.env.S3_ARTICLES_BUCKET_NAME = 'my-bucket';

      expect(service.getS3ArticlesBucketName()).toBe('my-bucket');
    });
  });

  describe('getAwsConfig', () => {
    afterEach(() => {
      delete process.env.AWS_ACCESS_KEY_ID;
      delete process.env.AWS_SECRET_ACCESS_KEY;
      delete process.env.AWS_REGION;
    });

    it('defaults region to us-east-1 and omits credentials when unset', () => {
      delete process.env.AWS_ACCESS_KEY_ID;
      delete process.env.AWS_SECRET_ACCESS_KEY;
      delete process.env.AWS_REGION;

      expect(service.getAwsConfig()).toEqual({
        credentials: undefined,
        region: 'us-east-1',
      });
    });

    it('returns credentials when both keys are set', () => {
      process.env.AWS_ACCESS_KEY_ID = 'key-id';
      process.env.AWS_SECRET_ACCESS_KEY = 'secret';
      process.env.AWS_REGION = 'eu-west-1';

      expect(service.getAwsConfig()).toEqual({
        credentials: { accessKeyId: 'key-id', secretAccessKey: 'secret' },
        region: 'eu-west-1',
      });
    });
  });

  describe('getRedisConfig', () => {
    afterEach(() => {
      delete process.env.REDIS_URL;
      delete process.env.REDISCLOUD_URL;
      delete process.env.REDIS_HOST;
      delete process.env.REDIS_PORT;
      delete process.env.REDIS_PASSWORD;
    });

    it('prefers REDIS_URL over REDISCLOUD_URL', () => {
      process.env.REDIS_URL = 'redis://primary';
      process.env.REDISCLOUD_URL = 'redis://fallback';

      expect(service.getRedisConfig().url).toBe('redis://primary');
    });

    it('falls back to REDISCLOUD_URL when REDIS_URL is unset', () => {
      delete process.env.REDIS_URL;
      process.env.REDISCLOUD_URL = 'redis://fallback';

      expect(service.getRedisConfig().url).toBe('redis://fallback');
    });

    it('defaults host/port when unset', () => {
      delete process.env.REDIS_URL;
      delete process.env.REDISCLOUD_URL;
      delete process.env.REDIS_HOST;
      delete process.env.REDIS_PORT;

      expect(service.getRedisConfig()).toEqual({
        url: undefined,
        host: 'localhost',
        port: 6379,
        password: undefined,
      });
    });
  });

  describe('getJwtSecret', () => {
    afterEach(() => {
      delete process.env.JWT_SECRET;
    });

    it('returns the configured secret', () => {
      process.env.JWT_SECRET = 'super-secret';

      expect(service.getJwtSecret()).toBe('super-secret');
    });

    it('throws when JWT_SECRET is unset', () => {
      delete process.env.JWT_SECRET;

      expect(() => service.getJwtSecret()).toThrow(
        'JWT_SECRET is required but not found in environment variables',
      );
    });

    it('throws when JWT_SECRET is blank', () => {
      process.env.JWT_SECRET = '   ';

      expect(() => service.getJwtSecret()).toThrow(
        'JWT_SECRET is required but not found in environment variables',
      );
    });
  });

  describe('getMeridianoApiKey', () => {
    afterEach(() => {
      delete process.env.MERIDIANO_API_KEY;
    });

    it('returns undefined when unset', () => {
      delete process.env.MERIDIANO_API_KEY;

      expect(service.getMeridianoApiKey()).toBeUndefined();
    });

    it('returns undefined when empty', () => {
      process.env.MERIDIANO_API_KEY = '';

      expect(service.getMeridianoApiKey()).toBeUndefined();
    });

    it('returns the configured key', () => {
      process.env.MERIDIANO_API_KEY = 'secret-key';

      expect(service.getMeridianoApiKey()).toBe('secret-key');
    });
  });

  describe('getMailgunConfig', () => {
    afterEach(() => {
      delete process.env.MAILGUN_API_KEY;
      delete process.env.MAILGUN_DOMAIN;
      delete process.env.MAILGUN_URL;
    });

    it('returns the configured mailgun settings', () => {
      process.env.MAILGUN_API_KEY = 'key';
      process.env.MAILGUN_DOMAIN = 'domain.com';
      process.env.MAILGUN_URL = 'https://api.eu.mailgun.net';

      expect(service.getMailgunConfig()).toEqual({
        apiKey: 'key',
        domain: 'domain.com',
        url: 'https://api.eu.mailgun.net',
      });
    });

    it('returns undefined fields when unset', () => {
      delete process.env.MAILGUN_API_KEY;
      delete process.env.MAILGUN_DOMAIN;
      delete process.env.MAILGUN_URL;

      expect(service.getMailgunConfig()).toEqual({
        apiKey: undefined,
        domain: undefined,
        url: undefined,
      });
    });
  });

});
