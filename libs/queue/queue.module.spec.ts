import { EmailService } from '@libs/email';
import { RedisModule } from '@libs/redis';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
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
  const mockEmailService = mock<EmailService>();

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [RedisModule, QueueModule],
    })
      .overrideProvider(EmailService)
      .useValue(mockEmailService)
      .compile();
  });

  it('should compile successfully', () => {
    expect(module).toBeDefined();
  });

  it('should provide QueueService', () => {
    const service = module.get<QueueService>(QueueService);
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(QueueService);
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
