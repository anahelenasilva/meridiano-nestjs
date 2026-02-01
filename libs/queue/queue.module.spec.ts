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

// Mock AudioFilesModule to prevent it from loading real dependencies
jest.mock('../../src/audio-files/audio-files.module', () => {
  return {
    AudioFilesModule: class MockAudioFilesModule { },
  };
});

// Mock ProcessorModule to prevent loading the full dependency chain
jest.mock('../../src/processor/processor.module', () => {
  return {
    ProcessorModule: class MockProcessorModule { },
    ProcessorService: class MockProcessorService {
      processArticles = jest.fn().mockResolvedValue({ articlesProcessed: 1, errors: 0 });
      rateArticles = jest.fn().mockResolvedValue({ articlesRated: 1, errors: 0 });
      categorizeArticles = jest.fn().mockResolvedValue({ articlesCategorized: 1, errors: 0 });
    },
  };
});

// Mock ConfigModule to prevent loading the full dependency chain
jest.mock('../../src/config/config.module', () => {
  return {
    ConfigModule: class MockConfigModule { },
    ConfigService: class MockConfigService {
      get = jest.fn().mockReturnValue('mock-value');
      getArticleEmailsNotifications = jest.fn().mockReturnValue({
        failureNotificationEmail: 'test@example.com',
        failureNotificationEmailFrom: 'from@example.com',
      });
    },
  };
});

// Mock the ArticleProcessor to avoid the ProcessorService dependency
jest.mock('./processors/article.processor', () => {
  return {
    ArticleProcessor: class MockArticleProcessor {
      onModuleInit = jest.fn();
      onModuleDestroy = jest.fn();
    },
  };
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
  });

  it('should export QueueService', () => {
    const service = module.get<QueueService>(QueueService);
    expect(service).toBeDefined();
  });
});
