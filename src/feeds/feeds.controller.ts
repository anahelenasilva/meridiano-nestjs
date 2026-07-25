import { Public } from '@libs/auth';
import { Controller, Get, Header, Req } from '@nestjs/common';
import type { FeedRequest } from './feeds.types';
import { FeedsService } from './feeds.service';

@Controller('feeds')
export class FeedsController {
  constructor(private readonly feedsService: FeedsService) {}

  @Get('articles.xml')
  @Public()
  @Header('Content-Type', 'application/rss+xml; charset=utf-8')
  async getArticlesFeed(@Req() request: FeedRequest): Promise<string> {
    const channelLink = `${request.protocol}://${request.get('host')}${request.originalUrl}`;
    return this.feedsService.getArticlesRssFeed(channelLink);
  }
}
