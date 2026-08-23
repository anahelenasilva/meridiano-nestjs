import axios from 'axios';
import { mock } from 'jest-mock-extended';
import { ArticleIngestionService } from '../articles/ingestion/article-ingestion.service';
import { ConfigService } from '../config/config.service';
import { ProfilesService } from '../profiles/profiles.service';
import { FeedProfile } from '../shared/types/feed';
import { ScraperService } from './scraper.service';
import { ScrapingStats } from './scrapper.entity';
import * as sitemapFetcher from './sitemap-fetcher';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock('./sitemap-fetcher');
const mockedFetchEntries =
  sitemapFetcher.fetchSitemapEntries as jest.MockedFunction<
    typeof sitemapFetcher.fetchSitemapEntries
  >;

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

describe('ScraperService.scrapeSitemaps', () => {
  const ingestion = mock<ArticleIngestionService>();
  const profiles = mock<ProfilesService>();
  const config = mock<ConfigService>();
  let service: ScraperService;

  const source = {
    sitemapUrl: 'https://claude.com/sitemap.xml',
    urlPrefix: 'https://claude.com/blog/',
    name: 'Claude Blog',
    enabled: true,
  };

  beforeEach(() => {
    service = new ScraperService(ingestion, profiles, config);
    config.getAppConfig.mockReturnValue({
      maxArticlesForScrapping: 2,
    } as ReturnType<ConfigService['getAppConfig']>);
    jest
      .spyOn(service, 'fetchArticleContentAndOgImage')
      .mockResolvedValue({ content: 'body', ogImage: null, title: 'Post Title' });
  });

  afterEach(() => jest.clearAllMocks());

  it('ingests newest-first entries capped at maxArticlesForScrapping', async () => {
    mockedFetchEntries.mockResolvedValue([
      { url: 'https://claude.com/blog/old', lastmod: new Date('2026-01-01') },
      { url: 'https://claude.com/blog/new', lastmod: new Date('2026-08-01') },
      { url: 'https://claude.com/blog/mid', lastmod: new Date('2026-05-01') },
    ]);
    ingestion.articleExists.mockResolvedValue(false);

    const stats = await service.scrapeSitemaps(FeedProfile.TECHNOLOGY, [source]);

    expect(stats.newArticles).toBe(2);
    const ingestedUrls = ingestion.ingest.mock.calls.map((c) => c[0].url);
    expect(ingestedUrls).toEqual([
      'https://claude.com/blog/new',
      'https://claude.com/blog/mid',
    ]);
  });

  it('ingests with sitemap source, lastmod date, and extracted title', async () => {
    mockedFetchEntries.mockResolvedValue([
      {
        url: 'https://claude.com/blog/new',
        lastmod: new Date('2026-08-01T00:00:00.000Z'),
      },
    ]);
    ingestion.articleExists.mockResolvedValue(false);

    await service.scrapeSitemaps(FeedProfile.TECHNOLOGY, [source]);

    expect(ingestion.ingest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://claude.com/blog/new',
        title: 'Post Title',
        publishedDate: new Date('2026-08-01T00:00:00.000Z'),
        source: { type: 'sitemap', feedName: 'Claude Blog' },
      }),
    );
  });

  it('skips entries whose url already exists', async () => {
    mockedFetchEntries.mockResolvedValue([
      { url: 'https://claude.com/blog/new', lastmod: new Date('2026-08-01') },
    ]);
    ingestion.articleExists.mockResolvedValue(true);

    const stats = await service.scrapeSitemaps(FeedProfile.TECHNOLOGY, [source]);

    expect(ingestion.ingest).not.toHaveBeenCalled();
    expect(stats.newArticles).toBe(0);
  });

  it('counts an error and continues when a sitemap fetch throws', async () => {
    mockedFetchEntries.mockRejectedValue(new Error('sitemap 500'));

    const stats = await service.scrapeSitemaps(FeedProfile.TECHNOLOGY, [source]);

    expect(stats.errors).toBe(1);
    expect(stats.newArticles).toBe(0);
  });

  it('resolves sources from the profile when none are passed', async () => {
    profiles.getEnabledSitemapSourcesForProfile.mockReturnValue([source]);
    mockedFetchEntries.mockResolvedValue([]);

    const stats: ScrapingStats = await service.scrapeSitemaps(
      FeedProfile.TECHNOLOGY,
    );

    expect(profiles.getEnabledSitemapSourcesForProfile).toHaveBeenCalledWith(
      FeedProfile.TECHNOLOGY,
    );
    expect(stats.totalFeeds).toBe(1);
  });
});
