# PRD: AI Audio Generation for Article Summaries and YouTube Transcripts

## Introduction

Add optional AI-powered text-to-speech audio generation for article summaries and YouTube transcription summaries. When enabled via command flags, the system will generate MP3 audio files from the text summaries and store them in S3 with proper tracking in the database. This enables users to listen to summaries instead of reading them, improving accessibility and enabling consumption during activities like commuting or exercising.

## Goals

- Generate MP3 audio files from article summaries using OpenAI TTS API
- Generate MP3 audio files from YouTube transcription summaries using OpenAI TTS API
- Store generated audio files in S3 with date-based organization
- Track audio file metadata in a dedicated database table
- Add optional flags to existing commands (`runBriefing.ts` and `runProcessTranscriptions.ts`) to enable audio generation
- Handle errors gracefully without stopping the main processing workflow

## User Stories

### US-001: Create audio_files database table
**Description:** As a developer, I need a database table to track generated audio files and their relationships to articles and transcriptions.

**Acceptance Criteria:**
- [ ] Create migration file for `audio_files` table with columns: `id` (UUID primary key), `source_type` ('article' | 'transcription'), `source_id` (UUID, references article or transcription), `s3_bucket` (TEXT), `s3_key` (TEXT), `file_size_bytes` (INTEGER), `duration_seconds` (REAL, nullable), `created_at` (TIMESTAMP)
- [ ] Add unique constraint on (`source_type`, `source_id`) to prevent duplicate audio files
- [ ] Add indexes on `source_type`, `source_id`, and `created_at` for query performance
- [ ] Migration runs successfully without errors
- [ ] Typecheck passes

### US-002: Add OpenAI TTS client initialization to AiService
**Description:** As a developer, I need the AiService to initialize an OpenAI client configured for text-to-speech API calls.

**Acceptance Criteria:**
- [ ] Add `openaiTtsClient` private property to AiService
- [ ] Initialize OpenAI client in `initializeClients()` method using `OPENAI_API_KEY` environment variable
- [ ] Use default OpenAI base URL (no custom baseURL needed)
- [ ] Handle missing API key with clear error message
- [ ] Log successful initialization
- [ ] Typecheck passes

### US-003: Add text-to-speech method to AiService
**Description:** As a developer, I need a method in AiService that converts text to MP3 audio using OpenAI TTS API.

**Acceptance Criteria:**
- [ ] Add `generateAudio(text: string, voice?: string): Promise<Buffer | null>` method to AiService
- [ ] Use OpenAI TTS API (`audio.speech.create`) with model `tts-1` or `tts-1-hd`
- [ ] Support voice parameter (default to 'alloy', options: 'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer')
- [ ] Return audio as Buffer in MP3 format
- [ ] Handle API errors gracefully and return null on failure
- [ ] Log errors with context
- [ ] Typecheck passes

### US-004: Add upload method to S3Service
**Description:** As a developer, I need a method in S3Service to upload audio files directly to S3.

**Acceptance Criteria:**
- [ ] Add `uploadAudioFile(bucketName: string, key: string, audioBuffer: Buffer, contentType?: string): Promise<string>` method to S3Service
- [ ] Use `PutObjectCommand` from `@aws-sdk/client-s3`
- [ ] Set content type to 'audio/mpeg' by default (or provided contentType)
- [ ] Return the S3 key on success
- [ ] Handle errors with descriptive messages
- [ ] Typecheck passes

### US-005: Create AudioFilesService for database operations
**Description:** As a developer, I need a service to manage audio file records in the database.

**Acceptance Criteria:**
- [ ] Create `src/audio-files/audio-files.service.ts` with `@Injectable()` decorator
- [ ] Inject `DatabaseService` in constructor
- [ ] Add `saveAudioFile(sourceType: 'article' | 'transcription', sourceId: string, s3Bucket: string, s3Key: string, fileSizeBytes: number, durationSeconds?: number): Promise<string | null>` method
- [ ] Insert record into `audio_files` table with UUID generation
- [ ] Handle duplicate key errors (return null if audio already exists for source)
- [ ] Return inserted UUID on success
- [ ] Add `getAudioFileBySource(sourceType: 'article' | 'transcription', sourceId: string): Promise<AudioFile | null>` method
- [ ] Typecheck passes

### US-006: Create AudioFilesModule
**Description:** As a developer, I need a NestJS module for audio files functionality.

**Acceptance Criteria:**
- [ ] Create `src/audio-files/audio-files.module.ts`
- [ ] Import `DatabaseModule` and `S3Module`
- [ ] Provide and export `AudioFilesService`
- [ ] Add module to `AppModule` imports
- [ ] Typecheck passes

### US-007: Add audio generation to article processing workflow
**Description:** As a user, I want to generate audio for article summaries when processing articles by adding a flag to the briefing command.

**Acceptance Criteria:**
- [ ] Add `--generate-audio` or `--audio` flag to `runBriefing.ts` command
- [ ] When flag is present, after article summary is generated, call audio generation service
- [ ] Generate audio from `processed_content` (summary) field
- [ ] Upload audio to S3 with path: `audio/{YYYY-MM-DD}/article-{articleId}.mp3` (use `published_date` for date)
- [ ] Save audio file record to database via AudioFilesService
- [ ] Continue processing even if audio generation fails (log error and continue)
- [ ] Typecheck passes

### US-008: Add audio generation to transcription processing workflow
**Description:** As a user, I want to generate audio for YouTube transcription summaries when processing transcriptions by adding a flag to the transcription command.

**Acceptance Criteria:**
- [ ] Add `--generate-audio` or `--audio` flag to `runProcessTranscriptions.ts` command
- [ ] When flag is present, after transcription summary is generated, call audio generation service
- [ ] Generate audio from `transcription_summary` field
- [ ] Upload audio to S3 with path: `audio/{YYYY-MM-DD}/transcription-{transcriptionId}.mp3` (use `processed_at` date)
- [ ] Save audio file record to database via AudioFilesService
- [ ] Continue processing even if audio generation fails (log error and continue)
- [ ] Typecheck passes

### US-009: Create audio generation use case
**Description:** As a developer, I need a reusable use case that handles the complete audio generation workflow (generate, upload, save).

**Acceptance Criteria:**
- [ ] Create `src/usecases/audio/generate-audio.usecase.ts` with `@Injectable()` decorator
- [ ] Inject `AiService`, `S3Service`, `AudioFilesService`, and `ConfigService`
- [ ] Add `execute(input: GenerateAudioInput): Promise<GenerateAudioOutput>` method
- [ ] Input includes: `sourceType`, `sourceId`, `text`, `date` (for S3 path)
- [ ] Generate audio using AiService.generateAudio()
- [ ] Upload to S3 using S3Service.uploadAudioFile()
- [ ] Save record using AudioFilesService.saveAudioFile()
- [ ] Return success status and audio file ID or error message
- [ ] Handle all errors gracefully
- [ ] Typecheck passes

### US-010: Add environment variable for OpenAI API key
**Description:** As a developer, I need to configure the OpenAI API key for TTS functionality.

**Acceptance Criteria:**
- [ ] Document `OPENAI_API_KEY` environment variable in README or .env.example
- [ ] Add validation in AiService initialization to check for key presence
- [ ] Provide clear error message if key is missing when TTS is attempted
- [ ] Typecheck passes

## Functional Requirements

- FR-1: Audio generation must be optional and only occur when `--generate-audio` flag is provided
- FR-2: Audio files must be stored in S3 with path pattern: `audio/{YYYY-MM-DD}/{sourceType}-{sourceId}.mp3`
- FR-3: Audio files must be tracked in `audio_files` table with source type and ID references
- FR-4: Audio generation failures must not stop article or transcription processing
- FR-5: Audio must be generated from summary text (not raw content)
- FR-6: Audio format must be MP3
- FR-7: Audio generation must use OpenAI TTS API with configurable voice
- FR-8: System must prevent duplicate audio generation for the same source (unique constraint)
- FR-9: Audio file records must include file size and optional duration metadata
- FR-10: S3 bucket name must come from environment variable `S3_ARTICLES_BUCKET_NAME` (reuse existing)

## Non-Goals

- No audio playback functionality in the application
- No audio streaming or CDN integration
- No audio editing or post-processing
- No support for other audio formats besides MP3
- No batch audio generation for multiple sources at once
- No audio quality selection (always uses default TTS model)
- No custom voice training or voice cloning
- No audio file deletion or cleanup workflows
- No audio generation for briefings (only articles and transcriptions)

## Design Considerations

- Reuse existing S3 bucket infrastructure (`S3_ARTICLES_BUCKET_NAME`)
- Follow existing command pattern using commander.js flags
- Use date-based S3 organization for easier file management and potential cleanup policies
- Audio generation happens after summary generation, ensuring summaries exist before audio creation
- Error handling follows existing patterns: log and continue, don't fail the main workflow

## Technical Considerations

- OpenAI TTS API has rate limits and costs per character - consider text length limits
- Audio files may be large (several MB per file) - ensure S3 bucket has appropriate storage class
- Database table uses UUIDs to match existing schema patterns
- Audio generation adds latency to processing - should be async/non-blocking where possible
- Need to handle cases where summary text is empty or null (skip audio generation)
- S3 key format uses date from source (article published_date or transcription processed_at)
- OpenAI TTS has maximum text length limits (4096 characters for tts-1) - may need truncation

## Success Metrics

- Audio files successfully generated for 95%+ of articles/transcriptions when flag is enabled
- Audio generation errors don't prevent article/transcription processing completion
- Audio files are correctly stored in S3 and retrievable
- Database records correctly link audio files to their sources
- Command execution time increases by less than 50% when audio generation is enabled

## Open Questions

- Should there be a text length limit before generating audio? (OpenAI TTS has 4096 character limit)
- Should audio generation be rate-limited or queued to avoid API throttling?
- Should we support regenerating audio if it already exists (override existing)?
- Should audio file size or duration be stored/validated?
- Should we add a separate command to regenerate audio for existing summaries?
- What voice should be the default? (OpenAI offers: alloy, echo, fable, onyx, nova, shimmer)
