export interface DBYoutubeTranscription {
  id: number;
  channelId: string;
  channelName: string;
  videoTitle: string;
  postedAt?: Date;
  videoUrl: string;
  processedAt: Date;
  transcriptionText: string;
  transcriptionSummary?: string;
}

export interface YoutubeTranscription {
  id: number;
  channelId: string;
  channelName: string;
  videoTitle: string;
  postedAt?: Date;
  videoUrl: string;
  processedAt: Date;
  transcriptionText: string;
  transcriptionSummary?: string;
}

export interface PaginatedYoutubeTranscriptionInput {
  page?: number;
  perPage?: number;
  sort_by?: string;
  direction?: 'asc' | 'desc';
  channel_id?: string;
  channel_name?: string;
  search?: string;
  start_date?: string;
  end_date?: string;
  preset?: string;
}

export interface CountTotalTranscriptionsInput {
  channel_id?: string;
  channel_name?: string;
  search?: string;
  start_date?: string;
  end_date?: string;
}
