export interface YoutubeChannel {
  id: string;
  channelId: string;
  name: string;
  url: string;
  description: string | null;
  enabled: boolean;
  maxVideos: number | null;
  createdAt: Date;
  updatedAt: Date;
}
