import { FeedProfile } from '../../shared/types/feed';

export interface ProcessMarkdownArticleJobData {
  s3Bucket: string;
  s3Key: string;
  feedProfile: FeedProfile;
}
