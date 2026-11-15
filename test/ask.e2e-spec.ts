/**
 * E2E for `POST /api/ask`. The answerer and the source read services are mocked
 * below the real controller and AskService, so these tests assert the HTTP
 * contract: status codes, response body and what reaches the answerer.
 */
import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock, MockProxy } from 'jest-mock-extended';
import request from 'supertest';
import { App } from 'supertest/types';
import { DBArticle } from '../src/articles/article.entity';
import { ArticlesService } from '../src/articles/articles.service';
import { ANSWERER, Answerer } from '../src/ask/answerer';
import { AskController } from '../src/ask/ask.controller';
import { AskService } from '../src/ask/ask.service';
import { ConfigService } from '../src/config/config.service';
import { YoutubeTranscription } from '../src/youtube-transcriptions/entities/youtube-transcription.entity';
import { YoutubeTranscriptionsService } from '../src/youtube-transcriptions/services/youtube-transcriptions.service';

const ARTICLE_ID = '4f9d1f3e-8a5b-4c2d-9e7f-1a2b3c4d5e6f';
const TRANSCRIPTION_ID = '7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d';

describe('Ask (e2e)', () => {
  let app: INestApplication<App>;
  let moduleFixture: TestingModule;
  let articlesService: MockProxy<ArticlesService>;
  let transcriptionsService: MockProxy<YoutubeTranscriptionsService>;
  let answerer: MockProxy<Answerer>;

  beforeAll(async () => {
    articlesService = mock<ArticlesService>();
    transcriptionsService = mock<YoutubeTranscriptionsService>();
    answerer = mock<Answerer>();
    const configService = mock<ConfigService>();
    configService.getEnabledChatModel.mockReturnValue('deepseek');

    moduleFixture = await Test.createTestingModule({
      controllers: [AskController],
      providers: [
        AskService,
        { provide: ArticlesService, useValue: articlesService },
        {
          provide: YoutubeTranscriptionsService,
          useValue: transcriptionsService,
        },
        { provide: ConfigService, useValue: configService },
        { provide: ANSWERER, useValue: answerer },
        {
          provide: APP_GUARD,
          useValue: {
            canActivate: (context: ExecutionContext) => {
              context.switchToHttp().getRequest().user = { id: 'user-1' };
              return true;
            },
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    articlesService.getArticleById.mockResolvedValue({
      id: ARTICLE_ID,
      title: 'Article title',
      raw_content: 'The raw article body.',
    } as DBArticle);
    transcriptionsService.getTranscriptionById.mockResolvedValue({
      id: TRANSCRIPTION_ID,
      videoTitle: 'Video title',
      transcriptionText: 'The full transcript.',
    } as YoutubeTranscription);
    answerer.answer.mockResolvedValue('**An** answer.');
  });

  afterAll(async () => {
    await app.close();
    await moduleFixture.close();
  });

  const ask = (body: object) =>
    request(app.getHttpServer()).post('/api/ask').send(body);

  it('answers a question about an Article', async () => {
    const response = await ask({
      source_type: 'article',
      source_id: ARTICLE_ID,
      question: 'What is it about?',
    }).expect(200);

    expect(response.body).toEqual({
      answer: '**An** answer.',
      model: 'deepseek',
      truncated: false,
    });
  });

  it('answers a question about a YouTube Transcription', async () => {
    const response = await ask({
      source_type: 'transcription',
      source_id: TRANSCRIPTION_ID,
      question: 'What was said?',
    }).expect(200);

    expect(response.body.answer).toBe('**An** answer.');
  });

  it('passes the earlier turns and the question to the answerer', async () => {
    await ask({
      source_type: 'article',
      source_id: ARTICLE_ID,
      question: 'And then?',
      history: [{ question: 'First?', answer: 'First answer.' }],
    }).expect(200);

    expect(answerer.answer).toHaveBeenCalledWith(
      expect.objectContaining({
        history: [{ question: 'First?', answer: 'First answer.' }],
        question: 'And then?',
      }),
    );
  });

  it('returns 404 for an unknown source', async () => {
    articlesService.getArticleById.mockResolvedValue(null);

    await ask({
      source_type: 'article',
      source_id: ARTICLE_ID,
      question: 'Anything?',
    }).expect(404);
  });

  it.each([
    ['an empty question', { question: '   ' }],
    ['an invalid source_type', { source_type: 'briefing' }],
    [
      'too many history turns',
      {
        history: Array.from({ length: 21 }, () => ({
          question: 'Q',
          answer: 'A',
        })),
      },
    ],
  ])('returns 400 for %s', async (_case, override) => {
    await ask({
      source_type: 'article',
      source_id: ARTICLE_ID,
      question: 'Valid question?',
      ...override,
    }).expect(400);

    expect(answerer.answer).not.toHaveBeenCalled();
  });

  it('returns 502 with the cause when the chat model fails', async () => {
    answerer.answer.mockRejectedValue(new Error('provider timed out'));

    const response = await ask({
      source_type: 'article',
      source_id: ARTICLE_ID,
      question: 'Anything?',
    }).expect(502);

    expect(response.body.message).toContain('provider timed out');
  });
});
