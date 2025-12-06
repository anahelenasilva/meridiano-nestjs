import { Injectable } from '@nestjs/common';
import { BriefingOptions } from '../briefing/briefing.entity';
import { ImpactRating, PromptVariables } from '../shared/types/ai';
import { FeedProfile } from '../shared/types/feed';
import { Config } from './config.entity';

@Injectable()
export class ConfigService {
  private readonly CONFIGS: Config = {
    prompts: {
      articleSummary: `
Summarize the key points of this news article objectively in 2-4 sentences.
Identify the main topics covered.

Article:
{article_content}
`,

      impactRating: `
Analyze the following news summary and estimate its overall impact. Consider factors like geographic scope (local vs global), number of people affected, severity, and potential long-term consequences.

Rate the impact on a scale of 1 to 10, where:
1-2: Minor, niche, or local interest.
3-4: Notable event for a specific region or community.
5-6: Significant event with broader regional or moderate international implications.
7-8: Major event with significant international importance or wide-reaching effects.
9-10: Critical global event with severe, widespread, or potentially historic implications.

Summary:
"{summary}"

Output ONLY the integer number representing your rating (1-10).
`,

      categoryClassification: `
Analyze the following article title and content to classify it into appropriate categories.

Available categories:
- news: General news articles
- blog: Blog posts or opinion pieces
- research: Research papers or technical studies
- nodejs: Node.js related content
- typescript: TypeScript related content
- tutorial: Tutorials or how-to guides
- other: Content that doesn't fit other categories

Article Title: "{title}"
Article Content: "{content}"

Analyze the content and return ONLY a JSON array of relevant categories. For example:
["news", "nodejs"] or ["tutorial", "typescript"] or ["research"]

Choose 1-3 most relevant categories. Return only the JSON array, no other text.
`,

      clusterAnalysis: `
These are summaries of potentially related news articles from a '{feed_profile}' context:

{cluster_summaries_text}

What is the core event or topic discussed? Summarize the key developments and significance in 3-5 sentences based *only* on the provided text. If the articles seem unrelated, state that clearly.
`,

      briefSynthesis: `
You are an AI assistant writing a Presidential-style daily intelligence briefing using Markdown, specifically for the '{feed_profile}' category.
Synthesize the following analyzed news clusters into a coherent, high-level executive summary.
Start with the 2-3 most critical overarching themes globally or within this category based *only* on these inputs.
Then, provide concise bullet points summarizing key developments within the most significant clusters (roughly 3-5 clusters).
Maintain an objective, analytical tone relevant to the '{feed_profile}' context. Avoid speculation.

Analyzed News Clusters (Most significant first):
{cluster_analyses_text}
`,
    },

    processing: {
      briefingArticleLookbackHours: 24,
      minArticlesForBriefing: 5,
      articlesPerPage: 15,
      clustersQtd: 10,
    },

    models: {
      deepseekChatModel: 'deepseek-chat',
      embeddingModel: 'togethercomputer/m2-bert-80M-32k-retrieval',
    },

    app: {
      defaultFeedProfile: 'default',
      databaseFile: 'meridian.db',
      maxArticlesForScrapping: 50,
    },

    youtubeTranscriptions: {
      channels: {
        'UCbRP3c757lWg9M-U7TyEkXA': {
          url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCbRP3c757lWg9M-U7TyEkXA',
          name: 'Theo Browne',
          description:
            'Theo is a software dev, AI nerd, TypeScript sympathizer, creator of T3 Chat and the T3 Stack.',
        },
      },
      maxVideosPerChannel: 1,
    },
  };

  getConfig(): Config {
    return this.CONFIGS;
  }

  getPrompt(promptType: keyof Config['prompts']): string {
    return this.CONFIGS.prompts[promptType];
  }

  formatPrompt(template: string, variables: PromptVariables): string {
    return Object.entries(variables).reduce(
      (prompt, [key, value]) =>
        prompt.replace(new RegExp(`{${key}}`, 'g'), String(value || '')),
      template,
    );
  }

  getArticleSummaryPrompt(articleContent: string): string {
    return this.formatPrompt(this.CONFIGS.prompts.articleSummary, {
      article_content: articleContent,
    });
  }

  getImpactRatingPrompt(summary: string): string {
    return this.formatPrompt(this.CONFIGS.prompts.impactRating, { summary });
  }

  getCategoryClassificationPrompt(title: string, content: string): string {
    return this.formatPrompt(this.CONFIGS.prompts.categoryClassification, {
      title,
      content,
    });
  }

  getClusterAnalysisPrompt(
    feedProfile: FeedProfile,
    clusterSummariesText: string,
    customPrompt?: string,
  ): string {
    const template = customPrompt || this.CONFIGS.prompts.clusterAnalysis;
    return this.formatPrompt(template, {
      feed_profile: feedProfile,
      cluster_summaries_text: clusterSummariesText,
    });
  }

  getBriefSynthesisPrompt(
    feedProfile: FeedProfile,
    clusterAnalysesText: string,
    customPrompt?: string,
  ): string {
    const template = customPrompt || this.CONFIGS.prompts.briefSynthesis;
    return this.formatPrompt(template, {
      feed_profile: feedProfile,
      cluster_analyses_text: clusterAnalysesText,
    });
  }

  getBriefingConfig(options?: BriefingOptions) {
    return {
      feedProfile: options?.feedProfile || this.CONFIGS.app.defaultFeedProfile,
      lookbackHours:
        options?.lookbackHours ||
        this.CONFIGS.processing.briefingArticleLookbackHours,
      minArticles:
        options?.minArticles || this.CONFIGS.processing.minArticlesForBriefing,
      customPrompts: options?.customPrompts,
      clustersQtd: this.CONFIGS.processing.clustersQtd,
      articlesPerPage: this.CONFIGS.processing.articlesPerPage,
    };
  }

  isValidImpactRating(rating: number): rating is ImpactRating {
    return Number.isInteger(rating) && rating >= 1 && rating <= 10;
  }

  getProcessingConfig() {
    return { ...this.CONFIGS.processing };
  }

  getModelConfig() {
    return { ...this.CONFIGS.models };
  }

  getAppConfig() {
    return { ...this.CONFIGS.app };
  }

  getYoutubeChannelsConfig() {
    return { ...this.CONFIGS.youtubeTranscriptions };
  }
}
