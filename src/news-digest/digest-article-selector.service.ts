import { Injectable } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { DBArticle } from '../articles/article.entity';
import { ConfigService } from '../config/config.service';

@Injectable()
export class DigestArticleSelectorService {
  constructor(
    private readonly aiService: AiService,
    private readonly configService: ConfigService,
  ) {}

  async selectTopArticles(articles: DBArticle[]): Promise<DBArticle[]> {
    if (articles.length === 0) {
      return [];
    }

    const criteria = this.configService.getNewsDigestPrompt();

    const articleList = articles
      .map(
        (article, i) =>
          `[${i + 1}] ID: ${article.id}\nTitle: ${article.title}\nSummary: ${(article.processed_content ?? article.raw_content ?? '').slice(0, 200)}`,
      )
      .join('\n\n');

    const prompt =
      `${criteria}\n\n` +
      `From the following articles, select the top 10 most personally relevant based on the criteria above. ` +
      `Return a JSON array of article IDs in order of relevance, with no other text. Example: ["id1","id2"]\n\n` +
      articleList;

    const response = await this.aiService.callChat(prompt);

    if (!response) {
      return [];
    }

    try {
      const trimmed = response.trim();
      let parsed: unknown;

      try {
        parsed = JSON.parse(trimmed);
      } catch {
        const match = trimmed.match(/\[[\s\S]*\]/);
        if (!match) {
          return [];
        }
        parsed = JSON.parse(match[0]);
      }

      if (!Array.isArray(parsed)) {
        return [];
      }

      const articleMap = new Map(articles.map((a) => [a.id, a]));

      return (parsed as unknown[])
        .filter((id): id is string => typeof id === 'string' && articleMap.has(id))
        .slice(0, 10)
        .map((id) => articleMap.get(id)!);
    } catch {
      return [];
    }
  }
}
