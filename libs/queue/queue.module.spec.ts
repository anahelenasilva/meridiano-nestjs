import { RedisModule } from '@libs/redis';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ARTICLE_PROCESSING_QUEUE,
  MARKDOWN_ARTICLE_PROCESSING_QUEUE,
  YOUTUBE_TRANSCRIPTION_SUMMARY_QUEUE,
} from './constants/queue.constants';
import { QueueModule } from './queue.module';
import { QueueService } from './queue.service';

describe('QueueModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [RedisModule, QueueModule],
    }).compile();
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
