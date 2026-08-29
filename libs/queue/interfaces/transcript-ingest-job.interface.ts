/**
 * One hand-picked video URL waiting to be ingested. The worker passes these
 * straight through to YoutubeTranscriptionsService.processSingleVideoUrl.
 */
export interface IngestTranscriptJobData {
  videoUrl: string;
  channelDbId: string;
  customPrompt?: string;
  generateAudio?: boolean;
}
