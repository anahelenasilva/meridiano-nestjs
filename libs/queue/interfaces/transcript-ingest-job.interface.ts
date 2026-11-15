/**
 * One hand-picked video URL waiting to be ingested. The worker passes these
 * straight through to YoutubeTranscriptionsExtractionService.processSingleVideoUrl.
 */
export interface IngestTranscriptJobData {
  videoUrl: string;
  channelDbId: string;
  customPrompt?: string;
  generateAudio?: boolean;
}
