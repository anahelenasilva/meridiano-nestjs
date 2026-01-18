import { FeedProfile } from '../../shared/types/feed';

export interface ProcessArticleJobData {
  articleFileKey: string;
  feedProfile: FeedProfile;
}
