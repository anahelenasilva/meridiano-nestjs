// Mock the entire email module BEFORE any other imports
// This prevents the real EmailModule from being loaded and requiring env vars
jest.mock('@libs/email', () => {
  const mockSendEmail = jest.fn().mockResolvedValue({ success: true });

  class MockEmailService {
    sendEmail = mockSendEmail;
  }

  return {
    EmailModule: {
      forRoot: jest.fn().mockReturnValue({
        module: class MockEmailModule { },
        providers: [
          {
            provide: 'EMAIL_PROVIDER',
            useValue: {
              sendEmail: mockSendEmail,
            },
          },
          {
            provide: MockEmailService,
            useClass: MockEmailService,
          },
        ],
        exports: [MockEmailService],
      }),
    },
    EmailService: MockEmailService,
  };
});

// Mock the database module to prevent actual DB connections in tests
jest.mock('@libs/database', () => {
  const mockDbConnection = {
    prepare: jest.fn().mockReturnValue({
      run: jest.fn(),
      finalize: jest.fn(),
    }),
    get: jest.fn(),
    all: jest.fn(),
    run: jest.fn(),
    exec: jest.fn(),
  };

  class MockDatabaseService {
    initDb = jest.fn().mockResolvedValue(undefined);
    closeDb = jest.fn().mockResolvedValue(undefined);
    getDbConnection = jest.fn().mockReturnValue(mockDbConnection);
  }

  return {
    DatabaseModule: class MockDatabaseModule {
      static forRoot = jest.fn().mockReturnValue({
        module: class MockDatabaseModuleClass { },
        providers: [
          {
            provide: 'DATABASE_SERVICE',
            useClass: MockDatabaseService,
          },
        ],
        exports: ['DATABASE_SERVICE'],
      });
    },
    DatabaseService: MockDatabaseService,
  };
});

// Mock ConfigModule to prevent loading the full dependency chain (the real
// ConfigModule pulls in YoutubeChannelsService and its TypeORM repositories).
// Backs the real ConfigService token with a mock value so RedisModule/
// EmailModule (which import ConfigService directly from config.service, not
// config.module) still resolve it to the same token.
jest.mock('../../src/config/config.module', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories can't reference out-of-scope imports
  const { Global, Module } = require('@nestjs/common');
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories can't reference out-of-scope imports
  const { ConfigService } = require('../../src/config/config.service');

  const mockConfigService = {
    get: jest.fn().mockReturnValue('mock-value'),
    getArticleEmailsNotifications: jest.fn().mockReturnValue({
      failureNotificationEmail: 'test@example.com',
      failureNotificationEmailFrom: 'from@example.com',
    }),
    getRedisConfig: jest.fn().mockReturnValue({
      url: undefined,
      host: 'localhost',
      port: 6379,
      password: undefined,
    }),
  };

  // @Global() to match the real ConfigModule: RedisModule/EmailModule no
  // longer import ConfigModule themselves (see redis.module.ts), so they
  // only see ConfigService if it's registered globally, same as production.
  @Global()
  @Module({
    providers: [{ provide: ConfigService, useValue: mockConfigService }],
    exports: [ConfigService],
  })
  class MockConfigModule {}

  return { ConfigModule: MockConfigModule };
});

// Mock QueueService to avoid ConfigService dependency
jest.mock('./queue.service', () => {
  return {
    QueueService: class MockQueueService {
      addArticleProcessingJob = jest.fn();
      addMarkdownArticleProcessingJob = jest.fn();
      addTranscriptionSummaryJob = jest.fn();
      getJobStatus = jest.fn();
      onModuleInit = jest.fn();
      onModuleDestroy = jest.fn();
    },
  };
});

import { Test, TestingModule } from '@nestjs/testing';
import {
  ARTICLE_PROCESSING_QUEUE,
  AUDIO_GENERATION_QUEUE,
  MARKDOWN_ARTICLE_PROCESSING_QUEUE,
  YOUTUBE_TRANSCRIPTION_SUMMARY_QUEUE,
} from './constants/queue.constants';
import { QueueModule } from './queue.module';
import { QueueService } from './queue.service';

jest.mock('ioredis');
jest.mock('bullmq');

describe('QueueModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [QueueModule],
    }).compile();
  });

  it('should compile successfully', () => {
    expect(module).toBeDefined();
  });

  it('should provide QueueService', () => {
    const service = module.get<QueueService>(QueueService);
    expect(service).toBeDefined();
  });

  it('should provide queue tokens', () => {
    const articleQueue = module.get(ARTICLE_PROCESSING_QUEUE);
    expect(articleQueue).toBeDefined();

    const markdownQueue = module.get(MARKDOWN_ARTICLE_PROCESSING_QUEUE);
    expect(markdownQueue).toBeDefined();

    const transcriptionQueue = module.get(YOUTUBE_TRANSCRIPTION_SUMMARY_QUEUE);
    expect(transcriptionQueue).toBeDefined();

    const audioQueue = module.get(AUDIO_GENERATION_QUEUE);
    expect(audioQueue).toBeDefined();
  });

  it('should export QueueService', () => {
    const service = module.get<QueueService>(QueueService);
    expect(service).toBeDefined();
  });
});
