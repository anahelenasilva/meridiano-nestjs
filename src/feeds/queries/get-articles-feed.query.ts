import { Injectable } from '@nestjs/common';
import { ArticlesService } from '../../articles/articles.service';
import { DBArticle } from '../../articles/article.entity';
import { buildRssFeed, RssFeedItem } from '../helpers/build-rss-feed';
import { FeedQueryOptions } from '../feeds.types';
import { FEED_DEFAULT_ITEM_LIMIT } from '../helpers/parse-feed-query';

export const FEED_CHANNEL_TITLE = 'Meridiano Articles';
export const FEED_CHANNEL_DESCRIPTION =
  'Latest Articles curated by Meridiano';

@Injectable()
export class GetArticlesFeedQuery {
  constructor(private readonly articlesService: ArticlesService) {}

  async execute(
    channelLink: string,
    options: FeedQueryOptions = {},
  ): Promise<string> {
    const { limit = FEED_DEFAULT_ITEM_LIMIT, feedProfile } = options;

    const articles = await this.articlesService.getArticlesPaginated({
      page: 1,
      perPage: limit,
      sortBy: 'published_date',
      direction: 'desc',
      feedProfile,
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
