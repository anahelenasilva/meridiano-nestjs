import { EmailService } from '@libs/email';
import { Test, TestingModule } from '@nestjs/testing';
import { Queue } from 'bullmq';
import { mock, mockReset } from 'jest-mock-extended';
import { ConfigService } from '../../src/config/config.service';
import {
  ARTICLE_PROCESSING_QUEUE,
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
  const mockConfigService = mock<ConfigService>();
  const mockEmailService = mock<EmailService>();

  beforeEach(async () => {
    mockReset(mockArticleQueue);
    mockReset(mockMarkdownArticleQueue);
    mockReset(mockTranscriptionSummaryQueue);
    mockReset(mockConfigService);
    mockReset(mockEmailService);

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
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
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
});
