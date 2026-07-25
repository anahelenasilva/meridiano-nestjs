import { mock } from 'jest-mock-extended';
import { ArticlesService } from '../../articles/articles.service';
import { DBArticle } from '../../articles/article.entity';
import { FeedProfile } from '../../shared/types/feed';
import { FEED_DEFAULT_ITEM_LIMIT } from '../helpers/parse-feed-query';
import { GetArticlesFeedQuery } from './get-articles-feed.query';

describe('GetArticlesFeedQuery', () => {
  const mockArticlesService = mock<ArticlesService>();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function buildQuery() {
    return new GetArticlesFeedQuery(mockArticlesService);
  }

  function buildArticle(overrides: Partial<DBArticle> = {}): DBArticle {
    return {
      id: 'article-1',
      url: 'https://source.example.com/article-1',
      title: 'Article One',
      published_date: new Date('2026-07-25T12:00:00.000Z'),
      feed_source: 'example-source',
      raw_content: 'raw body',
      processed_content: 'processed body',
      feed_profile: 'technology',
      created_at: new Date('2026-07-25T12:00:00.000Z'),
      ...overrides,
    };
  }

  it('requests the latest articles ordered by published date descending, bounded by the default limit', async () => {
    mockArticlesService.getArticlesPaginated.mockResolvedValue([]);

    const query = buildQuery();
    await query.execute('https://api.example.com/feeds/articles.xml');

    expect(mockArticlesService.getArticlesPaginated).toHaveBeenCalledWith({
      page: 1,
      perPage: FEED_DEFAULT_ITEM_LIMIT,
      sortBy: 'published_date',
      direction: 'desc',
      feedProfile: undefined,
    });
  });

  it('requests articles bounded by the given limit', async () => {
    mockArticlesService.getArticlesPaginated.mockResolvedValue([]);

    const query = buildQuery();
    await query.execute('https://api.example.com/feeds/articles.xml', {
      limit: 5,
    });

    expect(mockArticlesService.getArticlesPaginated).toHaveBeenCalledWith(
      expect.objectContaining({ perPage: 5 }),
    );
  });

  it('filters by feed profile when given', async () => {
    mockArticlesService.getArticlesPaginated.mockResolvedValue([]);

    const query = buildQuery();
    await query.execute('https://api.example.com/feeds/articles.xml', {
      feedProfile: FeedProfile.TECHNOLOGY,
    });

    expect(mockArticlesService.getArticlesPaginated).toHaveBeenCalledWith(
      expect.objectContaining({ feedProfile: FeedProfile.TECHNOLOGY }),
    );
  });

  it('renders valid RSS XML with the given channel link', async () => {
    mockArticlesService.getArticlesPaginated.mockResolvedValue([]);

    const query = buildQuery();
    const xml = await query.execute(
      'https://api.example.com/feeds/articles.xml',
    );

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain(
      '<link>https://api.example.com/feeds/articles.xml</link>',
    );
  });

  it('maps each article to a feed item with a stable GUID, title, canonical link, and pubDate', async () => {
    const article = buildArticle();
    mockArticlesService.getArticlesPaginated.mockResolvedValue([article]);

    const query = buildQuery();
    const xml = await query.execute(
      'https://api.example.com/feeds/articles.xml',
    );

    expect(xml).toContain(`<guid isPermaLink="false">${article.id}</guid>`);
    expect(xml).toContain(`<title>${article.title}</title>`);
    expect(xml).toContain(`<link>${article.url}</link>`);
    expect(xml).toContain(
      `<pubDate>${article.published_date.toUTCString()}</pubDate>`,
    );
  });

  it('uses processed_content as the item description when present', async () => {
    const article = buildArticle({ processed_content: 'processed body' });
    mockArticlesService.getArticlesPaginated.mockResolvedValue([article]);

    const query = buildQuery();
    const xml = await query.execute(
      'https://api.example.com/feeds/articles.xml',
    );

    expect(xml).toContain('<description>processed body</description>');
  });

  it('falls back to raw_content when processed_content is missing', async () => {
    const article = buildArticle({ processed_content: null });
    mockArticlesService.getArticlesPaginated.mockResolvedValue([article]);

    const query = buildQuery();
    const xml = await query.execute(
      'https://api.example.com/feeds/articles.xml',
    );

    expect(xml).toContain('<description>raw body</description>');
  });

  it('escapes XML-unsafe characters in article content so one malformed article cannot break the feed', async () => {
    const article = buildArticle({
      title: 'Breaking: <script>alert(1)</script> & more',
    });
    mockArticlesService.getArticlesPaginated.mockResolvedValue([article]);

    const query = buildQuery();
    const xml = await query.execute(
      'https://api.example.com/feeds/articles.xml',
    );

    expect(xml).not.toContain('<script>');
    expect(xml).toContain(
      '<title>Breaking: &lt;script&gt;alert(1)&lt;/script&gt; &amp; more</title>',
    );
  });

  it('returns an empty item list when there are no articles', async () => {
    mockArticlesService.getArticlesPaginated.mockResolvedValue([]);

    const query = buildQuery();
    const xml = await query.execute(
      'https://api.example.com/feeds/articles.xml',
    );

    expect(xml).not.toContain('<item>');
  });

  it('propagates errors from the articles service', async () => {
    mockArticlesService.getArticlesPaginated.mockRejectedValue(
      new Error('db unavailable'),
    );

    const query = buildQuery();

    await expect(
      query.execute('https://api.example.com/feeds/articles.xml'),
    ).rejects.toThrow('db unavailable');
  });
});
