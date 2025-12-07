export interface VideoMetadata {
  channel: {
    id: string;
    name: string;
    description: string;
  };
  videoId: string;
  title: string;
  url: string;
  publishedAt: string;
  description?: string;
  thumbnailUrl?: string;
}

export interface TranscriptItem {
  text: string;
  duration: number;
  offset: number;
}

export interface VideoWithTranscript extends VideoMetadata {
  transcript: TranscriptItem[];
  transcriptText: string; // Full transcript as a single string
}
