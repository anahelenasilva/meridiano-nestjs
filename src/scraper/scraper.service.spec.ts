import axios from 'axios';
import { mock } from 'jest-mock-extended';
import Parser from 'rss-parser';
import { ArticleIngestionService } from '../articles/ingestion/article-ingestion.service';
import { ConfigService } from '../config/config.service';
import { ProfilesService } from '../profiles/profiles.service';
import { FeedProfile, RSSFeed, SitemapSource } from '../shared/types/feed';
import { ScraperService } from './scraper.service';
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

describe('ScraperService.scrapeFeedProfile', () => {
  const ingestion = mock<ArticleIngestionService>();
  const profiles = mock<ProfilesService>();
  const config = mock<ConfigService>();
  const parseURL = jest.spyOn(Parser.prototype, 'parseURL');
  let service: ScraperService;

  const rssFeed: RSSFeed = {
    url: 'https://lethain.com/feeds/',
    name: 'Will Larson',
    enabled: true,
  };

  const sitemapSource: SitemapSource = {
    sitemapUrl: 'https://claude.com/sitemap.xml',
    urlPrefix: 'https://claude.com/blog/',
    name: 'Claude Blog',
    enabled: true,
  };

  // What the publisher emits: a feed <title> that differs from the config name.
  const publisherFeed = {
    title: 'Irrational Exuberance',
    items: [
      {
        link: 'https://lethain.com/post',
        title: 'A post',
        pubDate: 'Mon, 24 Aug 2026 10:00:00 GMT',
      },
    ],
  };

  function givenSources(feeds: RSSFeed[], sitemaps: SitemapSource[]) {
    profiles.getEnabledFeedsForProfile.mockReturnValue(feeds);
    profiles.getEnabledSitemapSourcesForProfile.mockReturnValue(sitemaps);
  }

  function ingestedSources() {
    return ingestion.ingest.mock.calls.map(([input]) => input.source);
  }

  beforeEach(() => {
    service = new ScraperService(ingestion, profiles, config);
    config.getAppConfig.mockReturnValue({
      maxArticlesForScrapping: 2,
    } as ReturnType<ConfigService['getAppConfig']>);
    ingestion.articleExists.mockResolvedValue(false);
    parseURL.mockResolvedValue(publisherFeed as never);
    mockedFetchEntries.mockResolvedValue([]);
    jest
      .spyOn(service, 'fetchArticleContentAndOgImage')
      .mockResolvedValue({
        content: 'body',
        ogImage: null,
        title: 'Post Title',
      });
  });

  afterEach(() => jest.clearAllMocks());

  afterAll(() => parseURL.mockRestore());

  it('reports no sources and scrapes nothing for a profile without sources', async () => {
    givenSources([], []);

    const result = await service.scrapeFeedProfile(FeedProfile.TECHNOLOGY);

    expect(result).toEqual({ status: 'no_sources' });
    expect(parseURL).not.toHaveBeenCalled();
    expect(mockedFetchEntries).not.toHaveBeenCalled();
  });

  it('scrapes RSS feeds and sitemap sources in one call', async () => {
    givenSources([rssFeed], [sitemapSource]);
    mockedFetchEntries.mockResolvedValue([
      { url: 'https://claude.com/blog/new', lastmod: new Date('2026-08-01') },
    ]);

    const result = await service.scrapeFeedProfile(FeedProfile.TECHNOLOGY);

    expect(result).toMatchObject({
      status: 'scraped',
      rss: { newArticles: 1, errors: 0 },
      sitemap: { newArticles: 1, errors: 0 },
    });
    expect(ingestedSources()).toEqual([
      { type: 'rss', feedName: 'Will Larson' },
      { type: 'sitemap', feedName: 'Claude Blog' },
    ]);
  });

  it('scrapes a profile that has only sitemap sources', async () => {
    givenSources([], [sitemapSource]);
    mockedFetchEntries.mockResolvedValue([
      { url: 'https://claude.com/blog/new', lastmod: new Date('2026-08-01') },
    ]);

    const result = await service.scrapeFeedProfile(FeedProfile.TECHNOLOGY);

    expect(result).toMatchObject({
      status: 'scraped',
      rss: { newArticles: 0 },
      sitemap: { newArticles: 1 },
    });
    expect(parseURL).not.toHaveBeenCalled();
  });

  it('names the Article Source from the configured feed name, not the publisher title', async () => {
    givenSources([rssFeed], []);

    await service.scrapeFeedProfile(FeedProfile.TECHNOLOGY);

    expect(ingestedSources()).toEqual([
      { type: 'rss', feedName: 'Will Larson' },
    ]);
  });

  it('counts an RSS error and still scrapes sitemaps when a feed fails', async () => {
    givenSources([rssFeed], [sitemapSource]);
    parseURL.mockRejectedValue(new Error('feed 500'));
    mockedFetchEntries.mockResolvedValue([
      { url: 'https://claude.com/blog/new', lastmod: new Date('2026-08-01') },
    ]);

    const result = await service.scrapeFeedProfile(FeedProfile.TECHNOLOGY);

    expect(result).toMatchObject({
      status: 'scraped',
      rss: { newArticles: 0, errors: 1 },
      sitemap: { newArticles: 1, errors: 0 },
    });
  });

  it('ingests sitemap entries newest-first, capped at maxArticlesForScrapping', async () => {
    givenSources([], [sitemapSource]);
    mockedFetchEntries.mockResolvedValue([
      { url: 'https://claude.com/blog/old', lastmod: new Date('2026-01-01') },
      { url: 'https://claude.com/blog/new', lastmod: new Date('2026-08-01') },
      { url: 'https://claude.com/blog/mid', lastmod: new Date('2026-05-01') },
    ]);

    await service.scrapeFeedProfile(FeedProfile.TECHNOLOGY);

    expect(ingestion.ingest.mock.calls.map(([input]) => input.url)).toEqual([
      'https://claude.com/blog/new',
      'https://claude.com/blog/mid',
    ]);
  });

  it('ingests a sitemap entry with its lastmod date and extracted title', async () => {
    givenSources([], [sitemapSource]);
    mockedFetchEntries.mockResolvedValue([
      {
        url: 'https://claude.com/blog/new',
        lastmod: new Date('2026-08-01T00:00:00.000Z'),
      },
    ]);

    await service.scrapeFeedProfile(FeedProfile.TECHNOLOGY);

    expect(ingestion.ingest).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Post Title',
        publishedDate: new Date('2026-08-01T00:00:00.000Z'),
      }),
    );
  });

  it('skips urls that already exist', async () => {
    givenSources([rssFeed], [sitemapSource]);
    mockedFetchEntries.mockResolvedValue([
      { url: 'https://claude.com/blog/new', lastmod: new Date('2026-08-01') },
    ]);
    ingestion.articleExists.mockResolvedValue(true);

    await service.scrapeFeedProfile(FeedProfile.TECHNOLOGY);

    expect(ingestion.ingest).not.toHaveBeenCalled();
  });

  it('counts a sitemap error when a sitemap fetch throws', async () => {
    givenSources([], [sitemapSource]);
    mockedFetchEntries.mockRejectedValue(new Error('sitemap 500'));

    const result = await service.scrapeFeedProfile(FeedProfile.TECHNOLOGY);

    expect(result).toMatchObject({
      status: 'scraped',
      sitemap: { newArticles: 0, errors: 1 },
    });
  });
});
