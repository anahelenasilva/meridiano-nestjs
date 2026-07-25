import { IS_PUBLIC_KEY } from '@libs/auth';
import { HEADERS_METADATA } from '@nestjs/common/constants';
import { mock } from 'jest-mock-extended';
import { FeedsController } from './feeds.controller';
import { GetArticlesFeedQuery } from './queries/get-articles-feed.query';
import { FeedRequest } from './feeds.types';
import { FeedProfile } from '../shared/types/feed';
import { FEED_DEFAULT_ITEM_LIMIT } from './helpers/parse-feed-query';

describe('FeedsController', () => {
  const mockGetArticlesFeedQuery = mock<GetArticlesFeedQuery>();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function buildController() {
    return new FeedsController(mockGetArticlesFeedQuery);
  }

  function buildRequest(overrides: Partial<FeedRequest> = {}): FeedRequest {
    return {
      protocol: 'https',
      originalUrl: '/feeds/articles.xml',
      get: jest.fn().mockReturnValue('api.example.com'),
      ...overrides,
    };
  }

  it('has @Public() on the getArticlesFeed endpoint', () => {
    const isPublic = Reflect.getMetadata(
      IS_PUBLIC_KEY,
      FeedsController.prototype.getArticlesFeed,
    );
    expect(isPublic).toBe(true);
  });

  it('sets the response content type to application/rss+xml', () => {
    const headers = Reflect.getMetadata(
      HEADERS_METADATA,
      FeedsController.prototype.getArticlesFeed,
    );
    expect(headers).toContainEqual({
      name: 'Content-Type',
      value: 'application/rss+xml; charset=utf-8',
    });
  });

  it('delegates to GetArticlesFeedQuery with a channel link built from the request', async () => {
    const xml = '<rss version="2.0"></rss>';
    mockGetArticlesFeedQuery.execute.mockResolvedValue(xml);

    const controller = buildController();
    const request = buildRequest();

    const result = await controller.getArticlesFeed(request);

    expect(result).toBe(xml);
    expect(mockGetArticlesFeedQuery.execute).toHaveBeenCalledWith(
      'https://api.example.com/feeds/articles.xml',
      { limit: FEED_DEFAULT_ITEM_LIMIT, feedProfile: undefined },
    );
  });

  it('parses the limit and feedProfile query params and passes them through', async () => {
    mockGetArticlesFeedQuery.execute.mockResolvedValue('<rss></rss>');

    const controller = buildController();
    const request = buildRequest();

    await controller.getArticlesFeed(request, '5', 'technology');

    expect(mockGetArticlesFeedQuery.execute).toHaveBeenCalledWith(
      'https://api.example.com/feeds/articles.xml',
      { limit: 5, feedProfile: FeedProfile.TECHNOLOGY },
    );
  });

  it('falls back to safe defaults for invalid limit and feedProfile query values', async () => {
    mockGetArticlesFeedQuery.execute.mockResolvedValue('<rss></rss>');

    const controller = buildController();
    const request = buildRequest();

    await controller.getArticlesFeed(request, 'not-a-number', 'not-a-profile');

    expect(mockGetArticlesFeedQuery.execute).toHaveBeenCalledWith(
      'https://api.example.com/feeds/articles.xml',
      { limit: FEED_DEFAULT_ITEM_LIMIT, feedProfile: undefined },
    );
  });

  it('builds the channel link from the request protocol, host, and original URL', async () => {
    mockGetArticlesFeedQuery.execute.mockResolvedValue('<rss></rss>');

    const controller = buildController();
    const request = buildRequest({
      protocol: 'http',
      originalUrl: '/feeds/articles.xml?feedProfile=technology',
      get: jest.fn().mockReturnValue('localhost:3001'),
    });

    await controller.getArticlesFeed(request);

    expect(mockGetArticlesFeedQuery.execute).toHaveBeenCalledWith(
      'http://localhost:3001/feeds/articles.xml?feedProfile=technology',
      { limit: FEED_DEFAULT_ITEM_LIMIT, feedProfile: undefined },
    );
  });

  it('propagates errors from GetArticlesFeedQuery', async () => {
    mockGetArticlesFeedQuery.execute.mockRejectedValue(
      new Error('feed generation failed'),
    );

    const controller = buildController();

    await expect(
      controller.getArticlesFeed(buildRequest()),
    ).rejects.toThrow('feed generation failed');
  });
});
