import { Injectable } from '@nestjs/common';
import { kmeans } from 'ml-kmeans';
import { AiService } from '../ai/ai.service';
import { ClusterAnalysis, DBArticle } from '../articles/article.entity';
import { ArticlesService } from '../articles/articles.service';
import {
  BriefGenerationOptions,
  GenerateBriefResult,
  SimpleBriefResult,
} from './briefing.entity';
import { BriefingsService } from '../briefings/briefings.service';
import { ConfigService } from '../config/config.service';
import { ProfilesService } from '../profiles/profiles.service';
import { FeedProfile } from '../shared/types/feed';

@Injectable()
export class BriefingService {
  constructor(
    private readonly articlesService: ArticlesService,
    private readonly briefingsService: BriefingsService,
    private readonly aiService: AiService,
    private readonly configService: ConfigService,
    private readonly profilesService: ProfilesService,
  ) {}

  private clusterArticles(
    embeddings: number[][],
    clustersQtd: number,
  ): number[] {
    if (embeddings.length < 2) {
      return embeddings.map(() => 0);
    }

    const effectiveClusters = Math.min(
      clustersQtd,
      Math.floor(embeddings.length / 2),
    );

    if (effectiveClusters < 2) {
      return embeddings.map(() => 0);
    }

    try {
      const result = kmeans(embeddings, effectiveClusters, {});
      return result.clusters;
    } catch (error) {
      console.error('Error during clustering:', error);
      return embeddings.map(() => 0);
    }
  }

  private async analyzeCluster(
    clusterArticles: DBArticle[],
    feedProfile: FeedProfile,
    clusterIndex: number,
    customPrompt?: string,
  ): Promise<ClusterAnalysis | null> {
    if (clusterArticles.length === 0) {
      return null;
    }

    console.log(
      `  Analyzing Cluster ${clusterIndex} (${clusterArticles.length} articles)`,
    );

    const maxSummariesPerCluster = 10;
    const selectedArticles = clusterArticles.slice(0, maxSummariesPerCluster);

    const clusterSummariesText = selectedArticles
      .map((article) => `- ${article.processed_content}`)
      .join('\n\n');

    const profilePrompts =
      this.profilesService.getPromptsForProfile(feedProfile);
    const promptToUse =
      customPrompt ||
      profilePrompts.clusterAnalysis ||
      this.configService.getPrompt('clusterAnalysis');
    const analysisPrompt = this.configService.formatPrompt(promptToUse, {
      feed_profile: feedProfile,
      cluster_summaries_text: clusterSummariesText,
    });

    const clusterAnalysis =
      await this.aiService.callDeepseekChat(analysisPrompt);

    if (!clusterAnalysis) {
      return null;
    }

    if (
      clusterAnalysis.toLowerCase().includes('unrelated') &&
      clusterArticles.length <= 2
    ) {
      return null;
    }

    return {
      topic: `Cluster ${clusterIndex + 1}`,
      analysis: clusterAnalysis,
      size: clusterArticles.length,
      articles: clusterArticles,
    };
  }

  async generateBrief(
    feedProfile: FeedProfile,
    options: Partial<BriefGenerationOptions> = {},
  ): Promise<GenerateBriefResult> {
    console.log(`\n--- Starting Brief Generation [${feedProfile}] ---`);

    const briefingConfig = this.configService.getBriefingConfig({
      feedProfile,
      lookbackHours: options.lookbackHours,
      minArticles: options.minArticles,
      customPrompts: options.customPrompts,
    });

    const articles = await this.articlesService.getArticlesForBriefing(
      briefingConfig.lookbackHours,
      feedProfile,
    );

    if (!articles || articles.length < briefingConfig.minArticles) {
      const error = `Not enough recent articles (${articles?.length || 0}) for profile '${feedProfile}'. Min required: ${briefingConfig.minArticles}.`;
      console.log(error);
      return { success: false, error };
    }

    console.log(`Generating brief from ${articles.length} articles.`);

    const articleIds = articles.map((a) => a.id);
    const articlesWithEmbeddings = articles.filter((a) => a.embedding);

    if (articlesWithEmbeddings.length !== articles.length) {
      console.log(
        `Warning: ${articles.length - articlesWithEmbeddings.length} articles are missing embeddings. Proceeding with available ones.`,
      );
    }

    if (articlesWithEmbeddings.length < briefingConfig.minArticles) {
      const error = `Not enough articles (${articlesWithEmbeddings.length}) with embeddings to cluster. Min required: ${briefingConfig.minArticles}.`;
      console.log(error);
      return { success: false, error };
    }

    const embeddings = articlesWithEmbeddings.map(
      (a) => JSON.parse(a.embedding!) as number[],
    );
    const clustersQtd = Math.min(
      briefingConfig.clustersQtd,
      Math.floor(articlesWithEmbeddings.length / 2),
    );

    if (clustersQtd < 2) {
      console.log(
        'Not enough articles to form meaningful clusters. Skipping clustering.',
      );
      return {
        success: false,
        error: 'Not enough articles to form meaningful clusters',
      };
    }

    console.log(
      `Clustering ${embeddings.length} articles into ${clustersQtd} clusters...`,
    );

    const clusterLabels = this.clusterArticles(embeddings, clustersQtd);
    const clusterGroups: DBArticle[][] = Array(clustersQtd)
      .fill(null)
      .map(() => []);

    articlesWithEmbeddings.forEach((article, index) => {
      const clusterLabel = clusterLabels[index];
      if (clusterLabel >= 0 && clusterLabel < clustersQtd) {
        clusterGroups[clusterLabel].push(article);
      }
    });

    console.log('Analyzing clusters...');
    const clusterAnalyses: ClusterAnalysis[] = [];

    for (let index = 0; index < clusterGroups.length; index++) {
      const clusterArticles = clusterGroups[index];

      if (clusterArticles.length === 0) continue;

      const analysis = await this.analyzeCluster(
        clusterArticles,
        feedProfile,
        index,
        options.customPrompts?.clusterAnalysis,
      );

      if (analysis) {
        clusterAnalyses.push(analysis);
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (clusterAnalyses.length === 0) {
      const error = 'No meaningful clusters found or analyzed.';
      console.log(error);
      return { success: false, error };
    }

    clusterAnalyses.sort((a, b) => b.size - a.size);

    const clusterAnalysesText = clusterAnalyses
      .slice(0, 5)
      .map(
        (cluster, index) =>
          `--- Cluster ${index + 1} (${cluster.size} articles) ---\nAnalysis: ${cluster.analysis}\n`,
      )
      .join('\n');

    const profilePrompts =
      this.profilesService.getPromptsForProfile(feedProfile);
    const promptToUse =
      options.customPrompts?.briefSynthesis ||
      profilePrompts.briefSynthesis ||
      this.configService.getPrompt('briefSynthesis');
    const briefSynthesisPrompt = this.configService.formatPrompt(promptToUse, {
      feed_profile: feedProfile,
      cluster_analyses_text: clusterAnalysesText,
    });

    const finalBriefMarkdown =
      await this.aiService.callDeepseekChat(briefSynthesisPrompt);

    if (!finalBriefMarkdown) {
      const error = 'Could not synthesize final brief.';
      console.log(`--- Brief Generation Failed [${feedProfile}]: ${error} ---`);
      return { success: false, error };
    }

    try {
      const briefingId = await this.briefingsService.saveBrief(
        finalBriefMarkdown,
        articleIds,
        feedProfile,
      );

      console.log(
        `--- Brief Generation Finished Successfully [${feedProfile}] ---`,
      );

      return {
        success: true,
        briefingId,
        content: finalBriefMarkdown,
        stats: {
          articlesAnalyzed: articlesWithEmbeddings.length,
          clustersGenerated: clustersQtd,
          clustersUsed: clusterAnalyses.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save brief',
      };
    }
  }

  async generateSimpleBrief(
    feedProfile: FeedProfile,
    maxArticles: number = 10,
  ): Promise<SimpleBriefResult> {
    console.log(`\n--- Generating Simple Brief [${feedProfile}] ---`);

    const lookbackHours =
      this.configService.getProcessingConfig().briefingArticleLookbackHours;
    const articles = await this.articlesService.getArticlesForBriefing(
      lookbackHours,
      feedProfile,
    );

    if (!articles || articles.length === 0) {
      return { success: false, error: 'No articles found for briefing' };
    }

    const selectedArticles = articles
      .sort((a, b) => (b.impact_rating || 0) - (a.impact_rating || 0))
      .slice(0, maxArticles);

    const summariesText = selectedArticles
      .map(
        (article, index) =>
          `${index + 1}. **${article.title}** (Impact: ${article.impact_rating || 'N/A'})\n   ${article.processed_content}\n`,
      )
      .join('\n');

    const briefPrompt = `Create a concise briefing for the '${feedProfile}' profile based on these recent articles:

${summariesText}

Format as a professional briefing with:
1. Executive Summary (2-3 key themes)
2. Key Developments (bullet points)
3. Analysis and Implications

Use Markdown formatting.`;

    const briefContent = await this.aiService.callDeepseekChat(briefPrompt);

    if (!briefContent) {
      return { success: false, error: 'Failed to generate brief content' };
    }

    try {
      const briefingId = await this.briefingsService.saveBrief(
        briefContent,
        selectedArticles.map((a) => a.id),
        feedProfile,
      );

      return {
        success: true,
        briefingId,
        content: briefContent,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save brief',
      };
    }
  }
}
