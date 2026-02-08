import { Injectable } from '@nestjs/common';
import { BriefingOptions } from '../briefing/briefing.entity';
import { ImpactRating, PromptVariables } from '../shared/types/ai';
import { FeedProfile } from '../shared/types/feed';
import { YoutubeChannelsService } from '../youtube-channels/youtube-channels.service';
import { ArticleEmailsNotifications, Config, VALID_CHAT_MODELS, ValidChatModel } from './config.entity';
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
  constructor(private readonly youtubeChannelsService: YoutubeChannelsService) { }

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
      openaiChatModel: 'gpt-4o-mini',
      embeddingModel: 'Alibaba-NLP/gte-modernbert-base',
      enabledChatModel: 'deepseek',
    },

    app: {
      defaultFeedProfile: FeedProfile.DEFAULT,
      databaseFile: 'meridian.db',
      maxArticlesForScrapping: 50,
    },

    youtubeTranscriptions: {
      channels: {}, // Now loaded from database
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

  async getYoutubeChannelsConfig() {
    // Delegate to YoutubeChannelsService for backward compatibility
    const channels = await this.youtubeChannelsService.getAllChannels();

    // Convert to old format for backward compatibility
    const channelsObj: Record<string, {
      name: string;
      url: string;
      description: string;
      enabled: boolean;
      maxVideos?: number;
    }> = {};

    channels.forEach((channel) => {
      channelsObj[channel.channelId] = {
        name: channel.name,
        url: channel.url,
        description: channel.description || '',
        enabled: channel.enabled,
        ...(channel.maxVideos ? { maxVideos: channel.maxVideos } : {}),
      };
    });

    return {
      channels: channelsObj,
      maxVideosPerChannel: this.CONFIGS.youtubeTranscriptions.maxVideosPerChannel,
    };
  }

  getRedisConfig() {
    return {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
    };
  }

  getArticleEmailsNotifications(): ArticleEmailsNotifications {
    return {
      failureNotificationEmail: process.env.ARTICLE_FAILURE_NOTIFICATION_EMAIL || '',
      failureNotificationEmailFrom: process.env.ARTICLE_FAILURE_NOTIFICATION_EMAIL_FROM || '',
    }
  }

  isBriefingsGenerationEnabled(): boolean {
    const value = process.env.ENABLE_BRIEFINGS_GENERATION;
    return value === 'true' || value === '1' || value === undefined;
  }

  getEnabledChatModel(): ValidChatModel {
    const envValue = process.env.ENABLED_CHAT_MODEL;
    if (envValue) {

      const validModels = Object.keys(VALID_CHAT_MODELS);
      if (!validModels.includes(envValue)) {
        throw new Error(
          `Invalid ENABLED_CHAT_MODEL value: '${envValue}'. Must be one of: ${validModels.join(', ')}.`,
        );
      }

      return envValue as ValidChatModel;
    }

    if (this.CONFIGS.models.enabledChatModel) {
      return this.CONFIGS.models.enabledChatModel;
    }

    throw new Error('No enabled chat model found in environment variables or config file');
  }
}
