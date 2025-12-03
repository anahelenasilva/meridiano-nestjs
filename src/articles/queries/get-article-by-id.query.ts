import { Injectable } from '@nestjs/common';
import { ArticlesService } from '../articles.service';
import { prepareArticleContent } from '../helpers/prepareArticleContent';

@Injectable()
export class GetArticleByIdQuery {
  constructor(private readonly service: ArticlesService) {}

  async execute(articleId: number) {
    const article = await this.service.getArticleById(articleId);

    if (!article) {
      return null;
    }

    const relatedArticles = await this.service.getRelatedArticles(articleId, 5);

    // Prepare article and related articles with HTML content
    const preparedArticle = await prepareArticleContent(article);
    const preparedRelatedArticles = await Promise.all(
      relatedArticles.map((article) => prepareArticleContent(article)),
    );

    return {
      article: preparedArticle,
      related_articles: preparedRelatedArticles,
    };
  }
}
