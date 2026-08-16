export interface DBYoutubeTranscription {
  id: string;
  /** Internal channel UUID (youtube_channels.id, the FK). */
  channelId: string;
  channelName: string;
  /** External YouTube channel id (youtube_channels.channel_id), from the join. */
  channelExternalId: string;
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
  /** Internal channel UUID (youtube_channels.id, the FK). */
  channelId: string;
  channelName: string;
  /** External YouTube channel id (youtube_channels.channel_id), from the join. */
  channelExternalId: string;
  videoTitle: string;
  postedAt?: Date;
  videoUrl: string;
  processedAt: Date;
  transcriptionText: string;
  transcriptionSummary?: string;
  thumbnailUrl?: string;
  custom_prompt?: string | null;
}
