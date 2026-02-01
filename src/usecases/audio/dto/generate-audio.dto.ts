export interface GenerateAudioInputDto {
  sourceType: 'article' | 'transcription';
  sourceId: string;
  text: string;
  date: Date;
}

export interface GenerateAudioOutputDto {
  success: boolean;
  audioFileId?: string;
  error?: string;
}
