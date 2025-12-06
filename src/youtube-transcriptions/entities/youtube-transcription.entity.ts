export interface DBYoutubeTranscription {
  id: number;
  channelId: string;
  channelName: string;
  videoTitle: string;
  postedAt: Date;
  videoUrl: string;
  processedAt: Date;
  transcriptionText: string;
}

export interface YoutubeTranscription {
  id: number;
  channelId: string;
  channelName: string;
  videoTitle: string;
  postedAt: Date;
  videoUrl: string;
  processedAt: Date;
  transcriptionText: string;
}
