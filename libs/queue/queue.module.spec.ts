import { RedisService } from '@libs/redis';
import { Test, TestingModule } from '@nestjs/testing';
import { Queue } from 'bullmq';
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
    // RedisService reads ConfigService, which the app registers globally.
    // Overriding it keeps this spec free of app code.
    module = await Test.createTestingModule({
      imports: [QueueModule],
    })
      .overrideProvider(RedisService)
      .useValue({ getClient: () => ({}) })
      .compile();
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

  it('gives markdown jobs three attempts with exponential backoff', () => {
    expect(Queue).toHaveBeenCalledWith(
      MARKDOWN_ARTICLE_PROCESSING_QUEUE,
      expect.objectContaining({
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        },
      }),
    );
  });

  it('should export QueueService', () => {
    const service = module.get<QueueService>(QueueService);
    expect(service).toBeDefined();
  });
});
