# Audio Generation Queue Migration Guide

## Overview

This document describes the migration from direct synchronous audio generation to an asynchronous job-based queue system. This change decouples audio generation from the main processing flow, improving reliability and scalability.

## What Changed

### Before: Direct Execution

Previously, audio generation was performed synchronously during article/transcription processing:

```typescript
// ProcessorService
if (generateAudio) {
  const audioResult = await this.generateAudioUseCase.execute({
    sourceType: 'article',
    sourceId: article.id,
    text: summary,
    date: article.published_date ? new Date(article.published_date) : new Date(),
  });
  // Blocks until audio generation completes
}
```

### After: Async Job Queue

Now, audio generation jobs are enqueued and processed asynchronously:

```typescript
// ProcessorService
if (generateAudio) {
  const jobInfo = await this.audioJobService.enqueueAudioJob({
    sourceType: 'article',
    sourceId: article.id,
    text: summary,
    date: article.published_date ? new Date(article.published_date) : new Date(),
  });
  console.log(`Audio generation job enqueued: ${jobInfo.jobId}`);
  // Returns immediately with job ID
}
```

## Breaking Changes

### Synchronous → Asynchronous Behavior

- **Old behavior**: Audio generation blocked the processing flow until completion
- **New behavior**: Audio generation is fire-and-forget; processing continues immediately

### Service Dependencies

| Service                       | Old Dependency         | New Dependency    |
| ----------------------------- | ---------------------- | ----------------- |
| ProcessorService              | `GenerateAudioUseCase` | `AudioJobService` |
| YoutubeTranscriptionProcessor | `GenerateAudioUseCase` | `AudioJobService` |

## New Components

### 1. AudioJobService

Located at `libs/queue/services/audio-job.service.ts`

**Public API:**

```typescript
// Enqueue an audio generation job
async enqueueAudioJob(
  data: GenerateAudioJobData,
  options?: EnqueueOptions,
): Promise<JobInfo | AudioJobStatus>

// Get job status by ID
async getJobStatus(jobId: string): Promise<AudioJobStatus | null>

// Get jobs by source type and ID
async getJobsBySource(
  sourceType: string,
  sourceId: string,
): Promise<AudioJobStatus[]>

// Cancel a pending job
async cancelJob(jobId: string): Promise<boolean>
```

### 2. AudioGenerationProcessor

Located at `libs/queue/processors/audio-generation.processor.ts`

BullMQ worker that processes audio generation jobs from the queue with:
- Retry logic (3 attempts with exponential backoff)
- Error classification (retryable vs fatal)
- Progress tracking (0%, 25%, 75%, 100%)
- Structured logging

### 3. Queue Constants

```typescript
// libs/queue/constants/queue.constants.ts
export const AUDIO_GENERATION_QUEUE = 'audio-generation';
export const GENERATE_AUDIO_JOB = 'generate-audio';
```

### 4. Interfaces

```typescript
// libs/queue/interfaces/audio-job.interface.ts
export interface GenerateAudioJobData {
  sourceType: 'article' | 'transcription';
  sourceId: string;
  text: string;
  date: Date;
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
  waitForCompletion?: boolean; // For backward compatibility
  priority?: number;
  delay?: number;
  timeout?: number;
}
```

## How to Check Job Status

### Using AudioJobService

```typescript
import { AudioJobService } from '@libs/queue';

@Injectable()
export class MyService {
  constructor(private readonly audioJobService: AudioJobService) {}

  async checkAudioStatus(jobId: string) {
    const status = await this.audioJobService.getJobStatus(jobId);

    if (status) {
      console.log(`Job ${status.jobId} is ${status.state}`);
      console.log(`Progress: ${status.progress}%`);

      if (status.result) {
        if (status.result.success) {
          console.log(`Audio file ID: ${status.result.audioFileId}`);
        } else {
          console.error(`Failed: ${status.result.error}`);
        }
      }
    }
  }
}
```

### Get Jobs by Source

```typescript
// Get all audio jobs for a specific article
const jobs = await this.audioJobService.getJobsBySource('article', articleId);

// Get all audio jobs for a specific transcription
const jobs = await this.audioJobService.getJobsBySource('transcription', transcriptionId);
```

## How to Handle Failures

### Retry Behavior

The system automatically retries failed jobs:
- **3 attempts** with exponential backoff (2s, 4s, 8s)
- **Retryable errors**: Network timeouts, S3 throttling, temporary AI service unavailability
- **Fatal errors**: Invalid input, missing environment variables, authentication failures (no retry)

### Monitoring Failed Jobs

```typescript
// Get failed jobs
const failedJobs = await audioQueue.getJobs(['failed']);

// Inspect failure reason
for (const job of failedJobs) {
  console.log(`Job ${job.id} failed:`, job.failedReason);
}
```

### Manual Retry

```typescript
// Get the failed job
const job = await audioQueue.getJob(jobId);

// Retry the job
await job.retry();
```

## Test Migration Examples

### Before: Mocking GenerateAudioUseCase

```typescript
const mockGenerateAudioUseCase = {
  execute: jest.fn().mockResolvedValue({ success: true, audioFileId: 'audio-123' }),
};

const module = await Test.createTestingModule({
  providers: [
    MyService,
    {
      provide: GenerateAudioUseCase,
      useValue: mockGenerateAudioUseCase,
    },
  ],
}).compile();
```

### After: Mocking AudioJobService

```typescript
const mockAudioJobService = {
  enqueueAudioJob: jest.fn().mockResolvedValue({ jobId: 'job-123', status: 'queued' }),
  getJobStatus: jest.fn().mockResolvedValue({
    jobId: 'job-123',
    state: 'completed',
    progress: 100,
    result: { success: true, audioFileId: 'audio-123' },
    data: { sourceType: 'article', sourceId: 'article-123', text: '...', date: new Date() },
  }),
  getJobsBySource: jest.fn().mockResolvedValue([]),
  cancelJob: jest.fn().mockResolvedValue(true),
};

const module = await Test.createTestingModule({
  providers: [
    MyService,
    {
      provide: AudioJobService,
      useValue: mockAudioJobService,
    },
  ],
}).compile();
```

## Rollback Strategy

If you need to rollback to the old synchronous behavior:

1. **Revert code changes** in `ProcessorService` and `YoutubeTranscriptionProcessor`
2. **Restore `GenerateAudioUseCase`** dependency
3. **Remove `AudioJobService`** dependency (optional - can coexist)

The `GenerateAudioUseCase` is still available and can be used directly if needed.

## Job Status Lifecycle

```
queued → waiting → active → completed
                          ↘ failed (→ retry) → completed/failed
```

### States

- `waiting`: Job is waiting to be processed
- `active`: Job is currently being processed
- `completed`: Job completed successfully
- `failed`: Job failed (may be retried)
- `delayed`: Job is scheduled for future execution
- `paused`: Queue is paused

## Configuration

### Default Job Options

```typescript
{
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000, // 2s, 4s, 8s
  },
  removeOnComplete: {
    count: 100, // Keep last 100 completed jobs
  },
  removeOnFail: {
    count: 500, // Keep last 500 failed jobs for debugging
  },
}
```

### Worker Concurrency

The audio generation processor processes **2 jobs in parallel** by default. This can be adjusted in `audio-generation.processor.ts`.

## Troubleshooting

### Common Issues

#### Jobs Not Being Processed

1. Check Redis connection
2. Verify the worker is initialized (check logs for "Audio generation processor worker initialized")
3. Check for errors in the worker logs

#### Jobs Failing Immediately

1. Check input data validation (text, sourceId, sourceType)
2. Verify environment variables (S3_ARTICLES_BUCKET_NAME)
3. Check AI service availability

#### Queue Growing Without Processing

1. Check worker concurrency settings
2. Verify no workers are stuck on long-running jobs
3. Check for error loops in worker logs

### Debug Logging

Enable debug logging to see detailed job lifecycle:

```typescript
// AudioJobService logs
{
  jobId: '123',
  sourceType: 'article',
  sourceId: 'article-456',
  operation: 'enqueue',
  status: 'queued',
}

// AudioGenerationProcessor logs
{
  jobId: '123',
  sourceType: 'article',
  sourceId: 'article-456',
  operation: 'start',
  status: 'processing',
}
```

## Future Enhancements

1. **Batch Processing**: Support for batch audio generation jobs
2. **Priority Queues**: High/low priority audio generation
3. **Scheduled Jobs**: Delayed audio generation
4. **Webhooks**: Callback notifications on job completion
5. **Job Metrics**: Track processing times, success rates
