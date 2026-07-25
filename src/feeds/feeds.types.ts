export interface FeedRequest {
  protocol: string;
  originalUrl: string;
  get(header: string): string | undefined;
}
