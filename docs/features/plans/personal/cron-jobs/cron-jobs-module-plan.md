# Cron Jobs Module Implementation Plan

## Overview
Create a comprehensive cron jobs module for the Meridiano NestJS API that enables independent execution of four critical tasks on Railway with separate cron schedules. Each job runs independently, exits cleanly, and leaves no open resources.

## Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────┐
│                    Railway Platform                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │ Cron Job 1       │  │ Cron Job 2       │                 │
│  │ briefing:tech    │  │ briefing:teclas  │                 │
│  │ 0 8 * * * (UTC)  │  │ 0 8 * * * (UTC)  │                 │
│  └────────┬─────────┘  └────────┬─────────┘                 │
│           │                     │                            │
│  ┌────────▼──────────┐  ┌───────▼──────────┐                │
│  │ Cron Job 3       │  │ Cron Job 4       │                │
│  │ yt-transcript    │  │ process-trans    │                │
│  │ 0 8 * * * (UTC)  │  │ 0 8 * * * (UTC)  │                │
│  └────────┬─────────┘  └────────┬─────────┘                │
│           │                     │                            │
│           └─────────────────────┴──────────────────┐         │
│                                                    │         │
│                              ┌─────────────────────▼──────┐  │
│                              │  NestJS API                │  │
│                              │  (Cron Module)             │  │
│                              │  - CronJobService          │  │
│                              │  - BriefingCronService     │  │
│                              │  - TranscriptCronService   │  │
│                              └────────────────────────────┘  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Module Structure

```
src/cron-jobs/
├── cron-jobs.module.ts
├── services/
│   ├── cron-job.service.ts (base service)
│   ├── briefing-cron.service.ts
│   └── transcript-cron.service.ts
├── interfaces/
│   ├── cron-job.interface.ts
│   └── cron-execution-result.interface.ts
└── dto/
    └── cron-execution-result.dto.ts
```

### Wrapper Scripts for Railway

```
src/cron-jobs/
├── runners/
│   ├── run-briefing-tech.ts
│   ├── run-briefing-teclas.ts
│   ├── run-yt-transcript.ts
│   └── run-process-transcriptions.ts
```

## Implementation Details

### 1. Cron Module Architecture

#### Core Interfaces

**`cron-job.interface.ts`**
- Defines contract for all cron jobs
- Methods: `execute()`, `validate()`, `cleanup()`
- Properties: `name`, `description`, `schedule`

**`cron-execution-result.interface.ts`**
- Standardized result format for all cron jobs
- Properties: `success`, `message`, `duration`, `startTime`, `endTime`, `error`

#### Base Service

**`cron-job.service.ts`**
- Abstract base class for all cron jobs
- Handles common logic: initialization, cleanup, error handling
- Provides logging utilities
- Ensures proper resource cleanup (database connections, etc.)

#### Specialized Services

**`briefing-cron.service.ts`**
- Extends `CronJobService`
- Executes briefing use cases (tech, teclas)
- Handles feed profile selection
- Manages audio generation flag

**`transcript-cron.service.ts`**
- Extends `CronJobService`
- Executes YouTube transcript extraction
- Executes transcription processing
- Manages audio generation for transcriptions

### 2. Cron Module

**`cron-jobs.module.ts`**
- Imports required modules (BriefingsModule, YoutubeTranscriptionsModule, etc.)
- Provides cron services
- Exports services for use in wrapper scripts

### 3. Wrapper Scripts for Railway

Each wrapper script:
1. Initializes NestJS application context
2. Calls appropriate cron service
3. Logs execution details
4. Closes all resources
5. Exits with appropriate status code

**Scripts:**
- `run-briefing-tech.ts` → calls `BriefingCronService.executeBriefingTech()`
- `run-briefing-teclas.ts` → calls `BriefingCronService.executeBriefingTeclas()`
- `run-yt-transcript.ts` → calls `TranscriptCronService.executeYoutubeTranscript()`
- `run-process-transcriptions.ts` → calls `TranscriptCronService.processTranscriptions()`

### 4. NPM Scripts

Add to `package.json`:
```json
{
  "scripts": {
    "cron:briefing:tech": "ts-node -r tsconfig-paths/register src/cron-jobs/runners/run-briefing-tech.ts",
    "cron:briefing:teclas": "ts-node -r tsconfig-paths/register src/cron-jobs/runners/run-briefing-teclas.ts",
    "cron:yt-transcript": "ts-node -r tsconfig-paths/register src/cron-jobs/runners/run-yt-transcript.ts",
    "cron:process-transcriptions": "ts-node -r tsconfig-paths/register src/cron-jobs/runners/run-process-transcriptions.ts"
  }
}
```

### 5. Railway Configuration

Update `railway.json` to include cron job services:

```json
{
  "build": {
    "buildCommand": "IS_BUILD=true pnpm install --frozen-lockfile && pnpm run build",
    "startCommand": "pnpm run migration:run && pnpm run start:prod"
  },
  "cronJobs": [
    {
      "name": "briefing-tech",
      "command": "pnpm run cron:briefing:tech",
      "schedule": "0 8 * * *"
    },
    {
      "name": "briefing-teclas",
      "command": "pnpm run cron:briefing:teclas",
      "schedule": "0 8 * * *"
    },
    {
      "name": "yt-transcript",
      "command": "pnpm run cron:yt-transcript",
      "schedule": "0 8 * * *"
    },
    {
      "name": "process-transcriptions",
      "command": "pnpm run cron:process-transcriptions",
      "schedule": "0 8 * * *"
    }
  ]
}
```

## Key Features

### 1. Independent Execution
- Each cron job runs independently on Railway
- No shared state between jobs
- Can be scheduled at different times
- Failures in one job don't affect others

### 2. Resource Management
- Proper cleanup of database connections
- Redis connection cleanup
- Application context closure
- No hanging processes

### 3. Error Handling
- Try-catch blocks with detailed error logging
- Graceful exit on errors
- Error messages logged to console
- Exit codes indicate success/failure

### 4. Logging
- Standardized log format with timestamps
- Job start/end logging
- Execution duration tracking
- Error details captured

### 5. Flexibility
- Easy to add new cron jobs
- Configurable schedules via Railway UI
- Can run jobs manually for testing
- Supports future enhancements (monitoring, retries, etc.)

## Deployment Steps

### 1. Local Testing
```bash
# Test individual cron jobs locally
pnpm run cron:briefing:tech
pnpm run cron:briefing:teclas
pnpm run cron:yt-transcript
pnpm run cron:process-transcriptions
```

### 2. Railway Deployment
1. Push code to repository
2. In Railway dashboard, create new services for each cron job
3. Set environment variables for each service
4. Configure cron schedule in service settings
5. Deploy

### 3. Monitoring
- Check Railway logs for execution status
- Monitor job duration and success rates
- Set up alerts for failures (optional)

## Environment Variables

All cron jobs use the same environment variables as the main API:
- `DATABASE_*` - Database connection
- `REDIS_*` - Redis connection
- `OPENAI_API_KEY` - For audio generation
- `DEEPSEEK_API_KEY` - For AI processing
- `EMBEDDING_API_KEY` - For embeddings
- `AWS_*` - For S3 storage
- `MAILGUN_*` - For email notifications

## Cron Schedule Reference

All jobs use UTC timezone (Railway default).

**Current Schedule: 8:00 AM UTC daily**
- Crontab: `0 8 * * *`
- In São Paulo (UTC-3): 5:00 AM

**To modify schedules:**
1. Update `railway.json` or
2. Use Railway dashboard → Service Settings → Cron Schedule

## Future Enhancements

1. **Execution History**: Store cron job execution results in database
2. **Retry Logic**: Automatic retry on failure with exponential backoff
3. **Monitoring Dashboard**: Web UI to view cron job status
4. **Notifications**: Email/Slack alerts on job failures
5. **Job Dependencies**: Chain jobs (e.g., process transcriptions after extraction)
6. **Performance Metrics**: Track execution time and resource usage
7. **Conditional Execution**: Skip jobs based on conditions

## Testing Strategy

### Unit Tests
- Test individual cron services
- Mock dependencies
- Verify error handling

### Integration Tests
- Test with real database
- Verify resource cleanup
- Test full execution flow

### Manual Testing
- Run scripts locally
- Verify output and logging
- Check database state after execution

## Documentation Files

1. **CRON_JOBS_SETUP.md** - Setup and configuration guide
2. **CRON_JOBS_DEPLOYMENT.md** - Railway deployment guide
3. **CRON_JOBS_TROUBLESHOOTING.md** - Common issues and solutions
