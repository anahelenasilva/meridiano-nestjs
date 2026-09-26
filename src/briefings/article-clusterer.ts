import { Injectable, Logger } from '@nestjs/common';
import { kmeans } from 'ml-kmeans';

export interface EmbeddedArticle {
  id: string;
  embedding: number[];
}

export interface ArticleCluster {
  label: number;
  articleIds: string[];
}

@Injectable()
export class ArticleClusterer {
  private readonly logger = new Logger(ArticleClusterer.name);

  /**
   * Groups articles into at most `k` clusters, clamped to half the article
   * count. Every embedding must share one dimension; the briefing candidate
   * pool guarantees that.
   */
  cluster(articles: EmbeddedArticle[], k: number): ArticleCluster[] {
    if (articles.length === 0) {
      return [];
    }

    if (articles.length < 2) {
      return [{ label: 0, articleIds: articles.map((a) => a.id) }];
    }

    const effectiveK = Math.min(k, Math.floor(articles.length / 2));

    if (effectiveK < 2) {
      return [{ label: 0, articleIds: articles.map((a) => a.id) }];
    }

    let clusterLabels: number[];
    try {
      const result = kmeans(
        articles.map((a) => a.embedding),
        effectiveK,
        {},
      );
      clusterLabels = result.clusters;
    } catch (error) {
      this.logger.warn(
        `Clustering failed (k=${effectiveK}), falling back to single cluster: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [{ label: 0, articleIds: articles.map((a) => a.id) }];
    }

    const clusterMap = new Map<number, string[]>();
    articles.forEach((article, index) => {
      const label = clusterLabels[index];
      let ids = clusterMap.get(label);
      if (ids === undefined) {
        ids = [];
        clusterMap.set(label, ids);
      }
      ids.push(article.id);
    });

    return Array.from(clusterMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([label, articleIds]) => ({ label, articleIds }));
  }
}
