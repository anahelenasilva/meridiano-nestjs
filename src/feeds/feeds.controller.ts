import { Public } from '@libs/auth';
import { Controller, Get, Header, Query, Req } from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import type { FeedRequest } from './feeds.types';
import {
  parseFeedLimit,
  parseFeedProfile,
} from './helpers/parse-feed-query';
import { GetArticlesFeedQuery } from './queries/get-articles-feed.query';

@Controller('feeds')
export class FeedsController {
  constructor(private readonly getArticlesFeedQuery: GetArticlesFeedQuery) {}

  @Get('articles.xml')
  @Public()
  @Header('Content-Type', 'application/rss+xml; charset=utf-8')
  @ApiOperation({ summary: 'Get the public RSS feed of articles' })
  @ApiOkResponse({ description: 'RSS XML feed', content: { 'application/rss+xml': { schema: { type: 'string' } } } })
  async getArticlesFeed(
    @Req() request: FeedRequest,
    @Query('limit') limit?: string,
    @Query('feedProfile') feedProfile?: string,
  ): Promise<string> {
    const channelLink = `${request.protocol}://${request.get('host')}${request.originalUrl}`;
    return this.getArticlesFeedQuery.execute(channelLink, {
      limit: parseFeedLimit(limit),
      feedProfile: parseFeedProfile(feedProfile),
    });
  }
}
