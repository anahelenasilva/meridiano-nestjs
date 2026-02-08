import { FeedProfile } from '../shared/types/feed';

export type ArticleEmailsNotifications = {
  failureNotificationEmail: string;
  failureNotificationEmailFrom: string;
};

export const VALID_CHAT_MODELS = { openai: 'gpt-4o-mini', deepseek: 'deepseek-chat' } as const;
export type ValidChatModel = keyof typeof VALID_CHAT_MODELS;

export type Config = {
  prompts: {
    articleSummary: string;
    impactRating: string;
    categoryClassification: string;
    clusterAnalysis: string;
    briefSynthesis: string;
    transcriptionSummary: string;
    transcriptionAnalysis: string;
    transcriptionClassification: string;
  };
  processing: {
    briefingArticleLookbackHours: number;
    minArticlesForBriefing: number;
    articlesPerPage: number;
    clustersQtd: number;
  };
  models: {
    deepseekChatModel: string;
    openaiChatModel: string;
    embeddingModel: string;
    enabledChatModel: ValidChatModel;
    maxTokens: number;
    temperature: number;
  };
  app: {
    defaultFeedProfile: FeedProfile;
    databaseFile: string;
    maxArticlesForScrapping: number;
  };
  youtubeTranscriptions: {
    channels: {
      [channelId: string]: {
        name: string;
        url: string;
        description: string;
        enabled: boolean;
        maxVideos?: number;
      };
    };
    maxVideosPerChannel: number;
  };
};
