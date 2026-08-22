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

// Snapshot of one non-completed queue job, used by GET /api/audio/jobs. Separate
// from AudioJobStatus (which mapJobToStatus produces for the single-job lookup
// endpoints and cannot distinguish queued from generating).
export interface AudioJobDescriptor {
  source_type: 'article' | 'transcription';
  source_id: string;
  state: 'queued' | 'generating' | 'failed';
  error: string | null;
}
