export interface GenerateAudioInputDto {
  sourceType: 'article' | 'transcription';
  sourceId: string;
  text: string;
  date: Date;
}
