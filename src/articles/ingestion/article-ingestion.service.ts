import { Injectable } from '@nestjs/common';
import { AiService } from '../../ai/ai.service';
import { articleSourceExtractionPrompt } from '../../config/prompts';
import { FeedProfile } from '../../shared/types/feed';
import { DBArticle } from '../article.entity';
import { ArticlesService } from '../articles.service';

export type ArticleSource =
  | { type: 'rss'; feedName: string }
  | { type: 'manual' }
  | { type: 'markdown' };

export interface RawArticleInput {
  url: string;
  title: string;
  content: string;
  publishedDate: Date;
  feedProfile: FeedProfile;
  source: ArticleSource;
  imageUrl?: string;
  customPrompt?: string;
}

@Injectable()
export class ArticleIngestionService {
  constructor(
    private readonly articlesService: ArticlesService,
    private readonly aiService: AiService,
  ) {}

  async ingest(rawArticle: RawArticleInput): Promise<DBArticle> {
    const existing = await this.articlesService.getArticleByUrl(rawArticle.url);
    if (existing) {
      return existing;
    }

    const feedSource = await this.resolveSource(rawArticle);

    const articleId = await this.articlesService.addArticle(
      rawArticle.url,
      rawArticle.title,
      rawArticle.publishedDate,
      feedSource,
      rawArticle.content,
      rawArticle.feedProfile,
      rawArticle.imageUrl,
      undefined,
      rawArticle.customPrompt,
    );

    if (!articleId) {
      // Race: another process inserted between our check and our insert
      const concurrent = await this.articlesService.getArticleByUrl(rawArticle.url);
      if (concurrent) {
        return concurrent;
      }
      throw new Error(`Failed to persist article: ${rawArticle.url}`);
    }

    const article = await this.articlesService.getArticleById(articleId);
    if (!article) {
      throw new Error(`Article ${articleId} not found after insertion`);
    }

    return article;
  }

  private async resolveSource(rawArticle: RawArticleInput): Promise<string> {
    switch (rawArticle.source.type) {
      case 'rss':
        return rawArticle.source.feedName;
      case 'manual':
        return 'Manual';
      case 'markdown': {
        const result = await this.aiService.callChat(
          articleSourceExtractionPrompt + rawArticle.content.substring(0, 2000),
        );
        return result?.trim() || 'Unknown';
      }
    }
  }
}
