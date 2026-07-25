import { Injectable } from '@nestjs/common';
import { ArticlesService } from '../articles/articles.service';
import { DBArticle } from '../articles/article.entity';
import { buildRssFeed, RssFeedItem } from './helpers/build-rss-feed';

export const FEED_DEFAULT_ITEM_LIMIT = 20;
export const FEED_CHANNEL_TITLE = 'Meridiano Articles';
export const FEED_CHANNEL_DESCRIPTION =
  'Latest Articles curated by Meridiano';

@Injectable()
export class FeedsService {
  constructor(private readonly articlesService: ArticlesService) {}

  async getArticlesRssFeed(channelLink: string): Promise<string> {
    const articles = await this.articlesService.getArticlesPaginated({
      page: 1,
      perPage: FEED_DEFAULT_ITEM_LIMIT,
      sortBy: 'published_date',
      direction: 'desc',
    });

    return buildRssFeed({
      title: FEED_CHANNEL_TITLE,
      link: channelLink,
      description: FEED_CHANNEL_DESCRIPTION,
      items: articles.map(toFeedItem),
    });
  }
}

function toFeedItem(article: DBArticle): RssFeedItem {
  return {
    guid: article.id,
    title: article.title,
    link: article.url,
    pubDate: article.published_date,
    description: article.processed_content ?? article.raw_content,
  };
}
