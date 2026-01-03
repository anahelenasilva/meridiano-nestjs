export interface DBYoutubeTranscription {
  id: string;
  channelId: string;
  channelName: string;
  videoTitle: string;
  postedAt?: Date;
  videoUrl: string;
  processedAt: Date;
  transcriptionText: string;
  transcriptionSummary?: string;
  thumbnailUrl?: string;
}

export interface YoutubeTranscription {
  id: string;
  channelId: string;
  channelName: string;
  videoTitle: string;
  postedAt?: Date;
  videoUrl: string;
  processedAt: Date;
  transcriptionText: string;
  transcriptionSummary?: string;
  thumbnailUrl?: string;
}
