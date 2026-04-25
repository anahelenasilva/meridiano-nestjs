import type { FeedProfile } from '../../../src/shared/types/feed';

export interface CustomBriefingJobData {
  articleIds: string[];
  feedProfile: FeedProfile;
  customPrompt?: string;
}
