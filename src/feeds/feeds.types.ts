import { FeedProfile } from '../shared/types/feed';

export interface FeedRequest {
  protocol: string;
  originalUrl: string;
  get(header: string): string | undefined;
}

export interface FeedQueryOptions {
  limit?: number;
  feedProfile?: FeedProfile;
}
