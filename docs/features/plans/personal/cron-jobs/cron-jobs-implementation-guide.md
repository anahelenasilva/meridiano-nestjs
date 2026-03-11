# Cron Jobs Implementation Guide

## Quick Summary

This guide provides a step-by-step implementation plan for creating a cron jobs module in the Meridiano NestJS API. The module will enable four independent cron jobs to run on Railway:

1. **briefing:tech** - Generate technology briefings
2. **briefing:teclas** - Generate teclas briefings
3. **yt-transcript** - Extract YouTube transcripts
4. **process-transcriptions** - Process transcription files

Each job runs independently, exits cleanly, and can be scheduled separately on Railway.

---

## Phase 1: Core Module Structure

### Step 1.1: Create Interfaces

**File: `src/cron-jobs/interfaces/cron-job.interface.ts`**
```typescript
export interface ICronJob {
  name: string;
  description: string;
  execute(): Promise<ICronExecutionResult>;
  cleanup(): Promise<void>;
}
```

**File: `src/cron-jobs/interfaces/cron-execution-result.interface.ts`**
```typescript
export interface ICronExecutionResult {
  success: boolean;
  message: string;
  duration: number;
  startTime: Date;
  endTime: Date;
  error?: string;
  data?: Record<string, any>;
}
```

### Step 1.2: Create Base Service

**File: `src/cron-jobs/services/cron-job.service.ts`**

This abstract base class provides:
- Common initialization logic
- Resource cleanup (DB, Redis, app context)
- Standardized logging
- Error handling
- Execution timing

Key methods:
- `initialize()` - Set up NestJS context
- `execute()` - Abstract method for subclasses
- `cleanup()` - Close all resources
- `log()` - Standardized logging
- `handleError()` - Error handling and logging

### Step 1.3: Create Specialized Services

**File: `src/cron-jobs/services/briefing-cron.service.ts`**

Extends `CronJobService` and implements:
- `executeBriefingTech()` - Run briefing for technology feed
- `executeBriefingTeclas()` - Run briefing for teclas feed
- Uses `RunBriefingUseCase` from BriefingsModule

**File: `src/cron-jobs/services/transcript-cron.service.ts`**

Extends `CronJobService` and implements:
- `executeYoutubeTranscript()` - Extract YouTube transcripts
- `processTranscriptions()` - Process transcription files
- Uses `ExtractYoutubeTranscriptsUseCase` and `ProcessTranscriptionFilesUseCase`

### Step 1.4: Create Module

**File: `src/cron-jobs/cron-jobs.module.ts`**

```typescript
@Module({
  imports: [
    BriefingsModule,
    YoutubeTranscriptionsModule,
    YoutubeChannelsModule,
    DatabaseModule,
    QueueModule,
  ],
  providers: [
    BriefingCronService,
    TranscriptCronService,
  ],
  exports: [
    BriefingCronService,
    TranscriptCronService,
  ],
})
export class CronJobsModule {}
```

---

## Phase 2: Wrapper Scripts for Railway

### Step 2.1: Create Briefing Tech Runner

**File: `src/cron-jobs/runners/run-briefing-tech.ts`**

```typescript
// Initialize NestJS context
// Call BriefingCronService.executeBriefingTech()
// Log results
// Close context
// Exit with status code
```

### Step 2.2: Create Briefing Teclas Runner

**File: `src/cron-jobs/runners/run-briefing-teclas.ts`**

Similar to briefing tech, but calls `executeBriefingTeclas()`

### Step 2.3: Create YouTube Transcript Runner

**File: `src/cron-jobs/runners/run-yt-transcript.ts`**

Calls `TranscriptCronService.executeYoutubeTranscript()`

### Step 2.4: Create Process Transcriptions Runner

**File: `src/cron-jobs/runners/run-process-transcriptions.ts`**

Calls `TranscriptCronService.processTranscriptions()`

---

## Phase 3: Configuration & Scripts

### Step 3.1: Update package.json

Add npm scripts for local testing:

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

### Step 3.2: Update railway.json

Add cron job configurations:

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

---

## Phase 4: Documentation

### Step 4.1: Create Setup Guide

**File: `docs/cron-jobs/CRON_JOBS_SETUP.md`**

Contents:
- Overview of cron jobs module
- Local setup instructions
- How to run jobs locally
- Environment variables required
- Troubleshooting common issues

### Step 4.2: Create Deployment Guide

**File: `docs/cron-jobs/CRON_JOBS_DEPLOYMENT.md`**

Contents:
- Railway deployment steps
- Creating cron services in Railway
- Configuring cron schedules
- Monitoring job execution
- Viewing logs

### Step 4.3: Create Troubleshooting Guide

**File: `docs/cron-jobs/CRON_JOBS_TROUBLESHOOTING.md`**

Contents:
- Common issues and solutions
- How to debug failed jobs
- Resource cleanup issues
- Database connection problems
- Timeout issues

---

## Implementation Checklist

### Core Module
- [ ] Create `cron-jobs/interfaces/cron-job.interface.ts`
- [ ] Create `cron-jobs/interfaces/cron-execution-result.interface.ts`
- [ ] Create `cron-jobs/services/cron-job.service.ts` (base class)
- [ ] Create `cron-jobs/services/briefing-cron.service.ts`
- [ ] Create `cron-jobs/services/transcript-cron.service.ts`
- [ ] Create `cron-jobs/cron-jobs.module.ts`

### Wrapper Scripts
- [ ] Create `cron-jobs/runners/run-briefing-tech.ts`
- [ ] Create `cron-jobs/runners/run-briefing-teclas.ts`
- [ ] Create `cron-jobs/runners/run-yt-transcript.ts`
- [ ] Create `cron-jobs/runners/run-process-transcriptions.ts`

### Configuration
- [ ] Update `package.json` with npm scripts
- [ ] Update `railway.json` with cron configurations

### Documentation
- [ ] Create `docs/cron-jobs/CRON_JOBS_SETUP.md`
- [ ] Create `docs/cron-jobs/CRON_JOBS_DEPLOYMENT.md`
- [ ] Create `docs/cron-jobs/CRON_JOBS_TROUBLESHOOTING.md`

### Testing
- [ ] Test each cron job locally
- [ ] Verify resource cleanup
- [ ] Test error handling
- [ ] Verify exit codes

---

## Key Design Decisions

### 1. Independent Services
Each cron job runs as a separate Railway service with its own schedule. This allows:
- Different execution times for each job
- Independent failure handling
- Better resource isolation
- Easier debugging

### 2. Wrapper Scripts
Wrapper scripts provide a clean entry point for Railway to call. They:
- Initialize the NestJS context
- Call the appropriate cron service
- Handle cleanup
- Exit with proper status codes

### 3. Base Service Class
The abstract `CronJobService` provides:
- Common initialization logic
- Standardized error handling
- Resource cleanup
- Consistent logging

### 4. No Scheduling Library
Unlike `node-cron` or similar libraries, we rely on Railway's native cron scheduling. This:
- Saves resources between executions
- Simplifies deployment
- Reduces complexity
- Aligns with Railway's best practices

---

## Environment Variables

All cron jobs use the same environment variables as the main API:

```
# Database
DATABASE_TYPE=postgres
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=password
DATABASE_NAME=meridian

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# AI Services
OPENAI_API_KEY=sk-...
DEEPSEEK_API_KEY=...
EMBEDDING_API_KEY=...

# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_ARTICLES_BUCKET_NAME=...

# Email
MAILGUN_API_KEY=...
MAILGUN_DOMAIN=...

# JWT
JWT_SECRET=...
```

---

## Cron Schedule Reference

**Current Schedule: 8:00 AM UTC daily**
- Crontab: `0 8 * * *`
- In São Paulo (UTC-3): 5:00 AM

**Common Schedules:**
- Every hour: `0 * * * *`
- Every 6 hours: `0 */6 * * *`
- Every day at 8 AM UTC: `0 8 * * *`
- Every Monday at 8 AM UTC: `0 8 * * 1`
- Every weekday at 8 AM UTC: `0 8 * * 1-5`

**To modify:**
1. Update `railway.json` and push to repository, OR
2. Use Railway dashboard → Service Settings → Cron Schedule

---

## Testing Strategy

### Local Testing
```bash
# Test individual jobs
pnpm run cron:briefing:tech
pnpm run cron:briefing:teclas
pnpm run cron:yt-transcript
pnpm run cron:process-transcriptions
```

### Verification Checklist
- [ ] Job completes successfully
- [ ] Database connections are closed
- [ ] Redis connections are closed
- [ ] No hanging processes
- [ ] Proper exit code (0 for success, 1 for failure)
- [ ] Logs are clear and informative

### Railway Testing
1. Deploy to Railway
2. Manually trigger each cron job
3. Check logs for successful execution
4. Verify database state after execution
5. Monitor for resource leaks

---

## Future Enhancements

1. **Execution History**: Store results in database
2. **Retry Logic**: Automatic retry on failure
3. **Monitoring Dashboard**: Web UI for job status
4. **Notifications**: Email/Slack alerts on failures
5. **Job Dependencies**: Chain jobs together
6. **Performance Metrics**: Track execution time
7. **Conditional Execution**: Skip jobs based on conditions
8. **Parallel Execution**: Run multiple jobs simultaneously
9. **Job Queuing**: Queue jobs if previous execution still running
10. **Rollback Capability**: Undo changes if job fails

---

## Support & Troubleshooting

### Common Issues

**Issue: Job times out on Railway**
- Solution: Increase timeout in Railway settings
- Check if job is taking longer than expected
- Consider breaking job into smaller tasks

**Issue: Database connections not closing**
- Solution: Ensure `cleanup()` is called
- Check for unclosed connections in use cases
- Verify app context is properly closed

**Issue: Job runs but doesn't complete**
- Solution: Check logs for errors
- Verify all dependencies are available
- Test locally first

**Issue: Multiple jobs running simultaneously**
- Solution: Stagger schedules in railway.json
- Use different times for each job
- Monitor resource usage

---

## References

- [Railway Cron Jobs Documentation](../cron-jobs/Cron%20Jobs.md)
- [NestFactory Documentation](https://docs.nestjs.com/application-context)
- [Crontab Expression Format](https://en.wikipedia.org/wiki/Cron)
