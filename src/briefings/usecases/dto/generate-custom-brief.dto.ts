import type { FeedProfile } from '../../../shared/types/feed';

export interface GenerateCustomBriefInputDto {
  articleIds: string[];
  feedProfile: FeedProfile;
  customPrompt?: string;
}
