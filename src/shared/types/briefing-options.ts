import { FeedProfile } from './feed';

export interface BriefingOptions {
  feedProfile?: FeedProfile;
  lookbackHours?: number;
  minArticles?: number;
  customPrompts?: Partial<{
    clusterAnalysis: string;
    briefSynthesis: string;
  }>;
}
