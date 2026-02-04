export interface GenerateAudioJobData {
  sourceType: 'article' | 'transcription';
  sourceId: string;
  text: string;
  date: Date;
}

export interface JobInfo {
  jobId: string;
  status: 'queued' | 'completed' | 'failed';
}

export interface AudioJobStatus {
  jobId: string;
  state: 'completed' | 'failed' | 'unknown';
  progress: number;
  result?: {
    audioKey?: string;
    duration?: number;
  };
  error?: string;
  data: GenerateAudioJobData;
}

export interface EnqueueOptions {
  priority?: number;
  delay?: number;
  waitForCompletion?: boolean;
  timeout?: number;
}
