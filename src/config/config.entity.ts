import { FeedProfile } from '../shared/types/feed';

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
    embeddingModel: string;
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
      };
    };
    maxVideosPerChannel: number;
  };
};
