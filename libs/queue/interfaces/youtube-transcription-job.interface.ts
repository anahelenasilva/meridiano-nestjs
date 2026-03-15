export interface ProcessTranscriptionSummaryJobData {
  transcriptionId: string;
  transcriptText: string;
  videoTitle: string;
  generateAudio?: boolean;
  channelId?: string;
}
