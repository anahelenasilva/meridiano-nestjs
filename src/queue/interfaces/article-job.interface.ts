import { FeedProfile } from '../../shared/types/feed';

export interface ProcessArticleJobData {
  articleId: number;
  feedProfile: FeedProfile;
}
