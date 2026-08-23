import axios from 'axios';
import { mock } from 'jest-mock-extended';
import { ArticleIngestionService } from '../articles/ingestion/article-ingestion.service';
import { ConfigService } from '../config/config.service';
import { ProfilesService } from '../profiles/profiles.service';
import { ScraperService } from './scraper.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ScraperService.fetchArticleContentAndOgImage', () => {
  let service: ScraperService;

  beforeEach(() => {
    service = new ScraperService(
      mock<ArticleIngestionService>(),
      mock<ProfilesService>(),
      mock<ConfigService>(),
    );
  });

  afterEach(() => jest.clearAllMocks());

  it('extracts the title from og:title', async () => {
    mockedAxios.get.mockResolvedValue({
      data: `<html><head>
        <meta property="og:title" content="A Field Guide to Fable" />
        <title>ignored</title>
      </head><body><article><p>Body text that is long enough to parse.</p></article></body></html>`,
    });

    const result = await service.fetchArticleContentAndOgImage(
      'https://claude.com/blog/a-field-guide',
    );

    expect(result.title).toBe('A Field Guide to Fable');
  });

  it('falls back to <title> when og:title is absent', async () => {
    mockedAxios.get.mockResolvedValue({
      data: `<html><head><title>Plain Title</title></head>
        <body><article><p>Body text that is long enough to parse.</p></article></body></html>`,
    });

    const result = await service.fetchArticleContentAndOgImage(
      'https://claude.com/blog/plain',
    );

    expect(result.title).toBe('Plain Title');
  });

  it('returns null title when the fetch throws', async () => {
    mockedAxios.get.mockRejectedValue(new Error('network down'));
    mockedAxios.isAxiosError.mockReturnValue(false);

    const result = await service.fetchArticleContentAndOgImage(
      'https://claude.com/blog/broken',
    );

    expect(result.title).toBeNull();
  });
});
