import { IS_PUBLIC_KEY } from '@libs/auth';
import { HEADERS_METADATA } from '@nestjs/common/constants';
import { mock } from 'jest-mock-extended';
import { FeedsController } from './feeds.controller';
import { FeedsService } from './feeds.service';
import { FeedRequest } from './feeds.types';

describe('FeedsController', () => {
  const mockFeedsService = mock<FeedsService>();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function buildController() {
    return new FeedsController(mockFeedsService);
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

  it('delegates to FeedsService with a channel link built from the request', async () => {
    const xml = '<rss version="2.0"></rss>';
    mockFeedsService.getArticlesRssFeed.mockResolvedValue(xml);

    const controller = buildController();
    const request = buildRequest();

    const result = await controller.getArticlesFeed(request);

    expect(result).toBe(xml);
    expect(mockFeedsService.getArticlesRssFeed).toHaveBeenCalledWith(
      'https://api.example.com/feeds/articles.xml',
    );
  });

  it('builds the channel link from the request protocol, host, and original URL', async () => {
    mockFeedsService.getArticlesRssFeed.mockResolvedValue('<rss></rss>');

    const controller = buildController();
    const request = buildRequest({
      protocol: 'http',
      originalUrl: '/feeds/articles.xml?feedProfile=technology',
      get: jest.fn().mockReturnValue('localhost:3001'),
    });

    await controller.getArticlesFeed(request);

    expect(mockFeedsService.getArticlesRssFeed).toHaveBeenCalledWith(
      'http://localhost:3001/feeds/articles.xml?feedProfile=technology',
    );
  });

  it('propagates errors from FeedsService', async () => {
    mockFeedsService.getArticlesRssFeed.mockRejectedValue(
      new Error('feed generation failed'),
    );

    const controller = buildController();

    await expect(
      controller.getArticlesFeed(buildRequest()),
    ).rejects.toThrow('feed generation failed');
  });
});
