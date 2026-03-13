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
  custom_prompt?: string | null;
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
  custom_prompt?: string | null;
}
