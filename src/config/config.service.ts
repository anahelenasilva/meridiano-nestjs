import { Injectable } from '@nestjs/common';
import { BriefingOptions } from '../briefing/briefing.entity';
import { ImpactRating, PromptVariables } from '../shared/types/ai';
import { FeedProfile } from '../shared/types/feed';
import { Config } from './config.entity';
import {
  articleSummaryPrompt,
  briefSynthesisPrompt,
  categoryClassificationPrompt,
  clusterAnalysisPrompt,
  impactRatingPrompt,
  transcriptionAnalysisPrompt,
  transcriptionClassificationPrompt,
  transcriptionSummaryPrompt,
} from './prompts';

@Injectable()
export class ConfigService {
  private readonly CONFIGS: Config = {
    prompts: {
      articleSummary: articleSummaryPrompt,
      impactRating: impactRatingPrompt,
      categoryClassification: categoryClassificationPrompt,
      clusterAnalysis: clusterAnalysisPrompt,
      briefSynthesis: briefSynthesisPrompt,
      transcriptionSummary: transcriptionSummaryPrompt,
      transcriptionClassification: transcriptionClassificationPrompt,
      transcriptionAnalysis: transcriptionAnalysisPrompt,
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
      defaultFeedProfile: FeedProfile.DEFAULT,
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
          enabled: true,
        },
        'UC-lHJZR3Gqxm24_Vd_AJ5Yw': {
          url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC-lHJZR3Gqxm24_Vd_AJ5Yw',
          name: 'PewDiePie',
          description:
            'PewDiePie is a Swedish YouTuber who is known for his comedic videos and gaming content.',
          enabled: false,
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

  getTranscriptionSummaryPrompt(transcriptionText: string): string {
    return this.formatPrompt(this.CONFIGS.prompts.transcriptionSummary, {
      article_content: transcriptionText,
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

  getRedisConfig() {
    return {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
    };
  }
}
