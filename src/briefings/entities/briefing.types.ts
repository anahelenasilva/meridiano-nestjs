import { FeedProfile } from '../../shared/types/feed';

export interface BriefGenerationOptions {
  feedProfile: FeedProfile;
  lookbackHours?: number;
  minArticles?: number;
  clustersQtd?: number;
  customPrompts?: {
    clusterAnalysis?: string;
    briefSynthesis?: string;
  };
}

export interface SimpleBriefResult {
  success: boolean;
  briefingId?: string;
  content?: string;
  customTitle?: string | null;
  error?: string;
}

export interface RecentBriefingResult {
  id: string;
  content: string;
  articleCount: number;
  createdAt: Date;
}

export interface GetBriefingTrendsResult {
  totalBriefings: number;
  avgArticlesPerBrief: number;
  briefingsPerDay: Array<BriefingsPerDay>;
}

export interface BriefingsPerDay {
  date: string;
  count: number;
}

export interface GenerateBriefResult {
  success: boolean;
  briefingId?: string;
  content?: string;
  error?: string;
  stats?: {
    articlesAnalyzed: number;
    clustersGenerated: number;
    clustersUsed: number;
  };
}

export interface GetBriefByIdResult {
  id: string;
  brief_markdown: string;
  generated_at: Date;
  feed_profile: string;
  isCustom: boolean;
  customTitle: string | null;
}

export interface BriefsMetadata {
  id: string;
  generated_at: Date;
  feed_profile: string;
  isCustom: boolean;
  customTitle: string | null;
}
