import { FeedProfile } from '../../shared/types/feed';

export interface ProcessArticleJobData {
  articleId: string;
  feedProfile: FeedProfile;
}
