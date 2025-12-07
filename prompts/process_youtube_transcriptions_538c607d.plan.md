---
name: Process YouTube transcriptions
overview: Create a command that reads JSON transcript files, summarizes them using AI, and saves the data to the youtube_transcriptions database table. The command will handle errors gracefully and preserve the JSON files.
todos:
  - id: add-db-method
    content: Add saveTranscriptionToDatabase() method to YoutubeTranscriptionsService to insert transcriptions into database
    status: pending
  - id: add-process-method
    content: Add processTranscriptionFile() method to YoutubeTranscriptionsService to read JSON, summarize, and save
    status: pending
  - id: add-prompt-helper
    content: Add getTranscriptionSummaryPrompt() helper method to ConfigService
    status: pending
  - id: create-command-script
    content: Create runProcessTranscriptions.ts command script that reads JSON files and processes them
    status: pending
  - id: add-package-script
    content: Add process-transcriptions script to package.json
    status: pending
---

# Process YouTube Transcriptions Command

## Overview

Create a new command script that processes existing YouTube transcription JSON files by:

1. Reading JSON files from the `transcripts/` directory
2. Summarizing transcription text using the existing `transcriptionSummary` prompt
3. Saving data to the `youtube_transcriptions` database table
4. Handling errors gracefully (log and continue to next file)

## Implementation Details

### 1. Create YouTube Transcriptions Service Method

**File**: `src/youtube-transcriptions/youtube-transcriptions.service.ts`

Add a method `saveTranscriptionToDatabase()` that:

- Takes a `VideoWithTranscript` object and channel metadata
- Inserts into `youtube_transcriptions` table with fields:
  - `channel_id`, `channel_name`, `video_title`, `posted_at`, `video_url`, `processed_at`, `transcription_text`
- Returns the inserted ID or null on error
- Handles both SQLite and PostgreSQL (via DatabaseService abstraction)

### 2. Create Transcription Processing Service Method

**File**: `src/youtube-transcriptions/youtube-transcriptions.service.ts`

Add a method `processTranscriptionFile()` that:

- Takes a file path and channel config
- Reads and parses the JSON file
- Extracts `transcriptText` for summarization
- Calls AI service with `transcriptionSummary` prompt
- Saves to database with summary in `transcription_summary` field
- Returns success/error status

### 3. Create Main Processing Command

**File**: `src/scripts/runProcessTranscriptions.ts`

Create a new command script that:

- Initializes NestJS application context
- Gets YouTube channels config to map channel IDs to channel names
- Reads all JSON files from `./transcripts/` directory
- For each file:
  - Extracts channel ID from filename pattern `{channelId}_{timestamp}.json`
  - Reads and validates JSON structure
  - Processes transcription (summarize + save to DB)
  - Logs errors but continues to next file
- Provides summary statistics (processed, errors, skipped)
- Does NOT delete JSON files

### 4. Add Helper Methods to Config Service

**File**: `src/config/config.service.ts`

Add method `getTranscriptionSummaryPrompt(transcriptionText: string)` that:

- Uses the existing `transcriptionSummary` prompt template
- Formats it with `{article_content}` variable (reusing existing pattern)

### 5. Update Package.json Script

**File**: `package.json`

Add a new script entry:

```json
"process-transcriptions": "ts-node -r tsconfig-paths/register src/scripts/runProcessTranscriptions.ts"
```

## Key Implementation Notes

- **Error Handling**: Wrap each file processing in try-catch, log errors with file path, continue processing
- **Database Compatibility**: Use `DatabaseService` abstraction to work with both SQLite and PostgreSQL
- **Channel Mapping**: Extract channel ID from filename and look up channel name from config
- **Date Parsing**: Parse `publishedAt` from JSON (currently "1 day ago" format) - may need to handle relative dates or use current date as fallback
- **Duplicate Prevention**: Check if transcription already exists (by `video_url` or `video_id`) before inserting
- **AI Prompt**: Use `transcriptionSummary` prompt with `{article_content}` placeholder for transcription text
- **File Preservation**: Never delete or move JSON files, only read them

## Files to Create/Modify

1. **Create**: `src/scripts/runProcessTranscriptions.ts` - Main command script
2. **Modify**: `src/youtube-transcriptions/youtube-transcriptions.service.ts` - Add database save and processing methods
3. **Modify**: `src/config/config.service.ts` - Add transcription summary prompt helper
4. **Modify**: `package.json` - Add script command

## Database Schema Reference

The `youtube_transcriptions` table has:

- `id` (auto-increment)
- `channel_id` TEXT NOT NULL
- `channel_name` TEXT NOT NULL  
- `video_title` TEXT NOT NULL
- `posted_at` TEXT NOT NULL
- `video_url` TEXT NOT NULL
- `processed_at` DATETIME/TIMESTAMP NOT NULL
- `transcription_text` TEXT NOT NULL
- `transcription_summary` TEXT NULL (will be populated)
- `transcription_analysis` TEXT NULL
- `transcription_cassification` TEXT NULL