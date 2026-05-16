import { Injectable } from '@nestjs/common';
import { DBArticle } from '../articles/article.entity';

@Injectable()
export class DigestEmailComposerService {
  compose(articles: DBArticle[]): string {
    if (articles.length === 0) {
      return 'No articles to display.';
    }

    return articles
      .map((article) => {
        const title = article.title || '';
        const source = article.feed_source || '';
        const url = article.url || '';
        return `${title}\n${source}\n${url}`;
      })
      .join('\n\n');
  }
}
