import { BadGatewayException, NotFoundException } from '@nestjs/common';
import { mock, MockProxy } from 'jest-mock-extended';
import { DBArticle } from '../articles/article.entity';
import { ArticlesService } from '../articles/articles.service';
import { ConfigService } from '../config/config.service';
import { YoutubeTranscription } from '../youtube-transcriptions/entities/youtube-transcription.entity';
import { YoutubeTranscriptionsService } from '../youtube-transcriptions/services/youtube-transcriptions.service';
import { Answerer } from './answerer';
import { AskService } from './ask.service';

const ARTICLE_ID = '4f9d1f3e-8a5b-4c2d-9e7f-1a2b3c4d5e6f';
const TRANSCRIPTION_ID = '7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d';

describe('AskService', () => {
  let articlesService: MockProxy<ArticlesService>;
  let transcriptionsService: MockProxy<YoutubeTranscriptionsService>;
  let configService: MockProxy<ConfigService>;
  let answerer: MockProxy<Answerer>;
  let service: AskService;

  beforeEach(() => {
    articlesService = mock<ArticlesService>();
    transcriptionsService = mock<YoutubeTranscriptionsService>();
    configService = mock<ConfigService>();
    answerer = mock<Answerer>();
    configService.getEnabledChatModel.mockReturnValue('deepseek');
    answerer.answer.mockResolvedValue('An answer.');
    service = new AskService(
      articlesService,
      transcriptionsService,
      configService,
      answerer,
    );
  });

  function givenArticle(overrides: Partial<DBArticle> = {}): void {
    articlesService.getArticleById.mockResolvedValue({
      id: ARTICLE_ID,
      title: 'Article title',
      raw_content: 'The raw article body.',
      processed_content: null,
      ...overrides,
    } as DBArticle);
  }

  it('answers an Article from its title and raw body, before its Article Summary exists', async () => {
    givenArticle();

    const response = await service.ask({
      source_type: 'article',
      source_id: ARTICLE_ID,
      question: 'What is it about?',
    });

    expect(answerer.answer).toHaveBeenCalledWith({
      model: 'deepseek',
      sourceTitle: 'Article title',
      sourceText: 'The raw article body.',
      history: [],
      question: 'What is it about?',
    });
    expect(response).toEqual({
      answer: 'An answer.',
      model: 'deepseek',
      truncated: false,
    });
  });

  it('answers a YouTube Transcription from its video title and transcript', async () => {
    transcriptionsService.getTranscriptionById.mockResolvedValue({
      id: TRANSCRIPTION_ID,
      videoTitle: 'Video title',
      transcriptionText: 'The full transcript.',
    } as YoutubeTranscription);

    await service.ask({
      source_type: 'transcription',
      source_id: TRANSCRIPTION_ID,
      question: 'What was said?',
    });

    expect(answerer.answer).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceTitle: 'Video title',
        sourceText: 'The full transcript.',
      }),
    );
  });

  it('cuts source text over the token cap and reports it as truncated', async () => {
    const longBody = 'This sentence repeats to make the source long. '.repeat(
      30_000,
    );
    givenArticle({ raw_content: longBody });

    const response = await service.ask({
      source_type: 'article',
      source_id: ARTICLE_ID,
      question: 'What is it about?',
    });

    const sentText = answerer.answer.mock.calls[0][0].sourceText;
    expect(sentText.length).toBeLessThan(longBody.length);
    expect(response.truncated).toBe(true);
  });

  it('throws NotFoundException for an unknown Article', async () => {
    articlesService.getArticleById.mockResolvedValue(null);

    await expect(
      service.ask({
        source_type: 'article',
        source_id: ARTICLE_ID,
        question: 'Anything?',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws NotFoundException for an unknown YouTube Transcription', async () => {
    transcriptionsService.getTranscriptionById.mockResolvedValue(null);

    await expect(
      service.ask({
        source_type: 'transcription',
        source_id: TRANSCRIPTION_ID,
        question: 'Anything?',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws BadGatewayException when the chat model returns an empty answer', async () => {
    givenArticle();
    answerer.answer.mockResolvedValue('   ');

    await expect(
      service.ask({
        source_type: 'article',
        source_id: ARTICLE_ID,
        question: 'Anything?',
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});
