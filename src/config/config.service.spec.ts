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
          useValue: mockYoutubeChannelsService
        }
      ],
    }).compile();

    service = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
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
      const originalValue = (service as unknown as { CONFIGS: { models: { enabledChatModel: string } } }).CONFIGS.models.enabledChatModel;
      (service as unknown as { CONFIGS: { models: { enabledChatModel: string } } }).CONFIGS.models.enabledChatModel = '';

      expect(() => service.getEnabledChatModel()).toThrow(
        'No enabled chat model found in environment variables or config file',
      );

      // Restore original value
      (service as unknown as { CONFIGS: { models: { enabledChatModel: string } } }).CONFIGS.models.enabledChatModel = originalValue;
    });
  });
});
