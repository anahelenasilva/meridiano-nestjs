import { FeedProfile } from '../../../src/shared/types/feed';

export interface ProcessArticleJobData {
  articleFileKey: string;
  feedProfile: FeedProfile;
}
