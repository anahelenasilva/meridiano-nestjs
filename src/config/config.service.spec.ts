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
});
