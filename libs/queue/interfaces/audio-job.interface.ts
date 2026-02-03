export interface GenerateAudioJobData {
  sourceType: 'article' | 'transcription';
  sourceId: string;
  text: string;
  date: Date | string;
  voice?: string;
}

export interface AudioJobStatus {
  jobId: string;
  state: string;
  progress: string | boolean | number | object;
  result?: {
    success: boolean;
    audioFileId?: string;
    error?: string;
  };
  error?: string;
  data: GenerateAudioJobData;
}

export interface EnqueueOptions {
  waitForCompletion?: boolean;
  priority?: number;
  delay?: number;
  timeout?: number;
}

export interface JobInfo {
  jobId: string;
  status: string;
}
