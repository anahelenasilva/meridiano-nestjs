import { BadRequestException, Injectable } from '@nestjs/common';
import { BriefingOptions } from '../shared/types/briefing-options';
import { ImpactRating, PromptVariables } from '../shared/types/ai';
import { FeedProfile } from '../shared/types/feed';
import { YoutubeChannelsService } from '../youtube-channels/youtube-channels.service';
import {
  ArticleEmailsNotifications,
  AudioFailureNotification,
  Config,
  EmbeddingFailureNotification,
  ProcessingMode,
  VALID_CHAT_MODELS,
  VALID_TTS_MODELS,
  ValidChatModel,
  ValidTtsModel,
} from './config.entity';
import {
  articleSummaryPrompt,
  briefSynthesisPrompt,
  categoryClassificationPrompt,
  clusterAnalysisPrompt,
  impactRatingPrompt,
  simpleBriefingPrompt,
  transcriptionAnalysisPrompt,
  transcriptionClassificationPrompt,
  transcriptionSummaryPrompt,
} from './prompts';

@Injectable()
export class ConfigService {
  constructor(
    private readonly youtubeChannelsService: YoutubeChannelsService,
  ) { }

  private readonly CONFIGS: Config = {
    prompts: {
      articleSummary: articleSummaryPrompt,
      impactRating: impactRatingPrompt,
      categoryClassification: categoryClassificationPrompt,
      clusterAnalysis: clusterAnalysisPrompt,
      briefSynthesis: briefSynthesisPrompt,
      simpleBriefing: simpleBriefingPrompt,
      transcriptionSummary: transcriptionSummaryPrompt,
      transcriptionClassification: transcriptionClassificationPrompt,
      transcriptionAnalysis: transcriptionAnalysisPrompt,
    },

    processing: {
      briefingArticleLookbackHours: 24,
      minArticlesForBriefing: 5,
      articlesPerPage: 15,
      clustersQtd: 10,
      clusterAnalysisDelayMs: 0,
    },

    models: {
      deepseekChatModel: 'deepseek-chat',
      openaiChatModel: 'gpt-4o-mini',
      embeddingModel: 'intfloat/multilingual-e5-large-instruct',
      enabledChatModel: 'deepseek',
      enabledTtsModel: 'openai',
      openaiTtsVoice: 'alloy',
      groqTtsVoice: 'hannah',
      maxTokens: 2048,
      temperature: 0.7,
    },

    app: {
      defaultFeedProfile: FeedProfile.DEFAULT,
      databaseFile: 'meridian.db',
      maxArticlesForScrapping: 50,
    },

    youtubeTranscriptions: {
      channels: {}, // Now loaded from database
      maxVideosPerChannel: 1,
      maxTranscriptionTokens: 100000,
      transcriptionChunkSize: 50000,
      transcriptionChunkOverlap: 500,
      defaultProcessingMode: 'chunked',
      fullContextChannels: [],
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

  getSimpleBriefPrompt(
    feedProfile: FeedProfile,
    summariesText: string,
    customPrompt?: string,
  ): string {
    const template = customPrompt || this.CONFIGS.prompts.simpleBriefing;
    return this.formatPrompt(template, {
      feed_profile: feedProfile,
      summaries_text: summariesText,
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
    const config = { ...this.CONFIGS.processing };
    const envDelay = process.env.CLUSTER_ANALYSIS_DELAY_MS;
    if (envDelay !== undefined && envDelay !== '') {
      const parsed = parseInt(envDelay, 10);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        config.clusterAnalysisDelayMs = parsed;
      }
    }
    return config;
  }

  getModelConfig() {
    const embeddingModel =
      process.env.EMBEDDING_MODEL || this.CONFIGS.models.embeddingModel;

    return {
      ...this.CONFIGS.models,
      embeddingModel,
    };
  }

  getAppConfig() {
    return { ...this.CONFIGS.app };
  }

  async getYoutubeChannelsConfig() {
    const channels = await this.youtubeChannelsService.getAllChannels();

    const channelsObj: Record<
      string,
      {
        name: string;
        url: string;
        description: string;
        enabled: boolean;
        maxVideos?: number;
      }
    > = {};

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
      maxVideosPerChannel:
        this.CONFIGS.youtubeTranscriptions.maxVideosPerChannel,
    };
  }

  getYoutubeTranscriptionsChunkingConfig() {
    const config = this.CONFIGS.youtubeTranscriptions;

    if (config.transcriptionChunkSize >= config.maxTranscriptionTokens) {
      throw new Error(
        'transcriptionChunkSize must be less than maxTranscriptionTokens',
      );
    }

    return {
      maxTranscriptionTokens: config.maxTranscriptionTokens,
      transcriptionChunkSize: config.transcriptionChunkSize,
      transcriptionChunkOverlap: config.transcriptionChunkOverlap,
    };
  }

  getProcessingModeForChannel(channelId: string): ProcessingMode {
    const config = this.CONFIGS.youtubeTranscriptions;
    if (config.fullContextChannels.includes(channelId)) {
      return 'full-context';
    }
    return config.defaultProcessingMode;
  }

  getPresignedUrlExpirySeconds(): number {
    const value = process.env.PRESIGNED_URL_EXPIRY_SECONDS;
    if (value === undefined || value === '') {
      return 3600;
    }
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed < 1) {
      return 3600;
    }
    return parsed;
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
      failureNotificationEmail:
        process.env.ARTICLE_FAILURE_NOTIFICATION_EMAIL || '',
      failureNotificationEmailFrom:
        process.env.ARTICLE_FAILURE_NOTIFICATION_EMAIL_FROM || '',
    };
  }

  getAudioFailureNotificationEmail(): AudioFailureNotification | null {
    const to = process.env.AUDIO_FAILURE_SUPPORT_EMAIL?.trim() || '';
    if (!to) {
      return null;
    }
    const from =
      process.env.AUDIO_FAILURE_SUPPORT_EMAIL_FROM?.trim() ||
      process.env.ARTICLE_FAILURE_NOTIFICATION_EMAIL_FROM?.trim() ||
      '';
    if (!from) {
      return null;
    }
    return { to, from };
  }

  getEmbeddingFailureNotificationEmail(): EmbeddingFailureNotification | null {
    const to = process.env.EMBEDDING_FAILURE_NOTIFICATION_EMAIL?.trim() || '';
    if (!to) {
      return null;
    }

    const from =
      process.env.EMBEDDING_FAILURE_NOTIFICATION_EMAIL_FROM?.trim() ||
      process.env.ARTICLE_FAILURE_NOTIFICATION_EMAIL_FROM?.trim() ||
      '';

    if (!from) {
      return null;
    }

    return { to, from };
  }

  isBriefingsGenerationEnabled(): boolean {
    const value = process.env.ENABLE_BRIEFINGS_GENERATION;
    return value === 'true' || value === '1' || value === undefined;
  }

  isExternalArticleSubmissionEnabled(): boolean {
    const value = process.env.TELEGRAM_INTEGRATION_ENABLED;
    return value === 'true' || value === '1';
  }

  /**
   * Get external API tokens from environment variable.
   * Tokens are comma-separated in EXTERNAL_API_TOKENS environment variable.
   */
  getExternalApiTokens(): string[] {
    const tokensEnv = process.env.EXTERNAL_API_TOKENS;
    if (!tokensEnv) {
      return [];
    }
    return tokensEnv.split(',').map(t => t.trim()).filter(Boolean);
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

    throw new BadRequestException(
      'No enabled chat model found in environment variables or config file',
    );
  }

  getEnabledTtsModel(): ValidTtsModel {
    const envValue = process.env.ENABLED_TTS_MODEL;
    if (envValue) {
      const validModels = Object.keys(VALID_TTS_MODELS);
      if (!validModels.includes(envValue)) {
        throw new Error(
          `Invalid ENABLED_TTS_MODEL value: '${envValue}'. Must be one of: ${validModels.join(', ')}.`,
        );
      }

      return envValue as ValidTtsModel;
    }

    if (this.CONFIGS.models.enabledTtsModel) {
      return this.CONFIGS.models.enabledTtsModel;
    }

    throw new BadRequestException(
      'No enabled TTS model found in environment variables or config file',
    );
  }
}
