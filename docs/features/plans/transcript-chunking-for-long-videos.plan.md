# Plan: Handle Transcripts Exceeding DeepSeek Model Context Limits

## Context

The YouTube transcription summary feature was silently truncating transcripts to 8000 characters before sending to the AI, causing loss of content. This was "fixed" by removing the truncation, but now we need to handle transcripts that could exceed DeepSeek's context limits.

**DeepSeek API Limits (current models):**
- **deepseek-chat (V3)**: 128K context window, 4K default max output, 8K absolute max output
- **deepseek-reasoner (R1)**: 128K context window, 32K default max output, 64K absolute max output

**Important**: The API is stateless - full conversation history counts against the 128K budget on every request.

**Current config**: `maxTokens: 2048` (in `config.service.ts:60`) - this is conservative and appropriate for summaries.

## Problem Statement

YouTube transcripts can vary widely in length:
- Short videos (5-10 min): ~1,000-3,000 words (~1,500-4,500 tokens)
- Medium videos (15-30 min): ~3,000-8,000 words (~4,500-12,000 tokens)
- Long videos (1+ hour): ~10,000-20,000+ words (~15,000-30,000+ tokens)

While 128K context is generous, extremely long transcripts (multi-hour content, multiple videos merged) could approach or exceed this limit when combined with the prompt template.

## Critical Files to Modify

1. **`src/shared/helpers/token-estimation.ts`** (NEW) - Shared helper:
   - `estimateTokenCount(text, charsPerToken)` - core estimation function
   - `estimateChatTokens(text)` - convenience for chat models (4 chars/token)
   - `estimateEmbeddingTokens(text)` - convenience for embeddings (2.5 chars/token)

2. **`src/youtube-transcriptions/services/transcript-chunking.service.ts`** (NEW) - Dedicated chunking service:
   - Token estimation using shared utility
   - Transcript splitting logic with sentence boundary awareness
   - Structure extraction and parsing
   - Chunk summary merging/synthesis with structure context
   - Intermediate result storage for failure recovery
   - Processing mode resolution (chunked vs full-context)

3. **`src/youtube-transcriptions/processors/youtube-transcription.processor.ts`** - Orchestration layer:
   - Inject `TranscriptChunkingService`
   - Handle chunked processing flow
   - Log chunking metrics (chunk count, tokens, timing, processing mode)
   - Handle partial failures with recovery

4. **`src/config/config.service.ts`** - Add configuration:
   - Add `maxTranscriptionTokens` config option (default: ~100K to leave room for prompt)
   - Add `transcriptionChunkSize` for chunking strategy
   - Add `transcriptionChunkOverlap` for boundary preservation
   - Add `defaultProcessingMode` and `fullContextChannels` for hybrid approach
   - Add `getProcessingModeForChannel()` method
   - Add configuration validation

5. **`src/config/config.entity.ts`** - Update types for new config options

6. **`src/config/prompts/transcription-summary.prompt.ts`** - Add chunking-aware prompts:
   - `structureExtractionPrompt` - extract video structure before chunking
   - `chunkSummaryWithStructurePrompt` - for individual chunks with context
   - `synthesisWithStructurePrompt` - for merging chunk summaries
   - `chunkSummaryPrompt` - simple fallback (no structure context)

7. **`src/ai/ai.service.ts`** - Minor refactor:
   - Replace inline `estimateTokenCount` with shared helper import
   - No chunking logic here (kept in dedicated service)

8. **`src/youtube-transcriptions/errors/transcript-chunking.errors.ts`** (NEW) - Explicit error types:
   - `TranscriptChunkingError` - base error for chunking failures
   - `StructureExtractionError` - error when structure extraction fails or returns malformed JSON
   - These enable better error handling, logging, and retry logic differentiation

## Implementation Approach

### Option 1: Smart Chunking with Hierarchical Summarization (Recommended)

**How it works:**
1. Estimate tokens of input transcript
2. If under threshold (~100K tokens), process normally
3. If over threshold:
   - Split transcript into overlapping chunks (e.g., 50K tokens each)
   - Process each chunk with a "summarize this section" prompt
   - Store intermediate chunk summaries (for recovery on failure)
   - Combine all chunk summaries with a "synthesize these summaries" prompt
   - Return final unified summary

**Pros:**
- Handles arbitrarily long transcripts
- Preserves key information from entire transcript
- Stays well within API limits
- Intermediate storage enables recovery from partial failures

**Cons:**
- More API calls (higher cost, more latency)
- May lose some nuance in chunking
- Increased complexity

### Option 2: Truncate with Warning

**How it works:**
- Keep a hard limit (e.g., 100K tokens)
- If transcript exceeds limit, truncate and log a warning
- Return summary of what fits

**Pros:**
- Simple implementation
- Predictable behavior

**Cons:**
- Loses information (the original problem!)
- Not acceptable for production use

### Option 3: Switch to deepseek-reasoner for long transcripts

**How it works:**
- Detect long transcripts
- Use R1 model (64K output vs 8K for V3) when needed

**Pros:**
- More output tokens for complex summaries

**Cons:**
- Still has 128K input limit (same as V3)
- R1 is optimized for reasoning, not summarization
- Doesn't solve the input problem

## Recommended Solution: Hybrid Approach with Structure-Aware Chunking

### Overview

The solution combines two processing strategies:

1. **Full-Context Mode**: For premium/high-priority channels, process the entire transcript without chunking (truncates only if exceeding absolute limits)
2. **Structure-Aware Chunking**: For standard channels, extract the video structure first, then chunk and summarize with that context preserved

This hybrid approach maximizes quality for important content while maintaining scalability for all videos.

### Processing Flow

```
Transcript
    │
    ▼
Get channel processing mode
    │
    ├── FULL-CONTEXT → Single API call (truncate if > 128K tokens)
    │
    └── CHUNKED (default) → Structure-Aware Chunking
                              │
                              ▼
                         1. Extract video structure (1 API call)
                         2. Split into overlapping chunks
                         3. Summarize each chunk WITH structure context
                         4. Synthesize summaries into final output
                              │
                              ▼
                         Fallback: Simple chunking (if structure extraction fails)
```

### Architecture Decision: Dedicated Chunking Service

**Rationale:** `AiService` is already 772 lines with mixed concerns (API orchestration + embedding chunking). Adding transcript-specific chunking would:
- Violate Single Responsibility Principle
- Create tighter coupling between AI service and transcript domain logic
- Make testing more difficult

**Solution:** Create `TranscriptChunkingService` that:
- Encapsulates all transcript chunking business logic
- Can be tested independently of API calls
- Keeps `AiService` focused on API communication
- Injects `AiService` via constructor (not method parameter)

### Implementation Details

**Token Estimation Helper:**

Extract to a shared helper to avoid code duplication with `AiService`:

```typescript
// src/shared/helpers/token-estimation.ts
export function estimateTokenCount(text: string, charsPerToken: number = 2.5): number {
  if (!text || text.length === 0) {
    return 0;
  }

  // Method 1: Character-based
  const charEstimate = Math.ceil(text.length / charsPerToken);

  // Method 2: Word-based with punctuation padding
  const words = text.trim().split(/\s+/).length;
  const punctuationMatches = text.match(/[.,!?;:"'()[\]{}]/g);
  const punctuationCount = punctuationMatches ? punctuationMatches.length : 0;
  const wordEstimate = words + Math.ceil(punctuationCount * 0.5);

  // Use the MORE conservative estimate
  return Math.max(charEstimate, wordEstimate);
}

// Convenience functions for different model types
export const estimateChatTokens = (text: string) => estimateTokenCount(text, 4);
export const estimateEmbeddingTokens = (text: string) => estimateTokenCount(text, 2.5);
```

**Chunking Strategy:**
- **Threshold**: 100K tokens (leave 28K buffer for prompt + output)
- **Chunk Size**: 50K tokens (allows 2 chunks before hitting threshold)
- **Overlap**: ~500 tokens between chunks (preserves context at boundaries)
- **Boundary Handling**: Split at sentence boundaries (reuse `splitTextByEstimatedTokens` pattern from `ai.service.ts:401-442`)

**Structure Extraction (Key Enhancement):**

Before chunking, extract the video's structure to preserve cross-chunk context:

1. **First API call**: Analyze transcript to identify sections, themes, and cross-references
2. **Chunk summarization**: Pass structure context to each chunk summary prompt
3. **Synthesis**: Combine chunk summaries with full structure awareness

This preserves:
- Cross-chunk references ("as I mentioned earlier...")
- Thematic continuity (narrative arcs across chunks)
- Structural markers (numbered lists, section headings)

**Flow:**
```
Transcript → Token Count → Under 100K?
                         │
                         ├── YES → Single API call → Summary
                         │
                         └── NO → Get channel processing mode
                                   │
                                   ├── FULL-CONTEXT → Single API call (truncate if needed)
                                   │
                                   └── CHUNKED → Extract structure (1 API call)
                                                 │
                                                 ▼
                                            Split into chunks
                                                 │
                                                 ▼
                                            Summarize chunks WITH structure context
                                                 │
                                                 ▼
                                            Store summaries (for recovery)
                                                 │
                                                 ▼
                                            Synthesize into final summary
                                                 │
                                                 ↓ (on failure)
                                            Retry synthesis with stored summaries
```

**New `TranscriptChunkingService` Interface:**
```typescript
type ProcessingMode = 'chunked' | 'full-context';

type VideoStructure = {
  sections: Array<{
    title: string;
    startPhrase: string;
  }>;
  keyThemes: string[];
  crossReferences: Array<{
    from: number;  // section index
    to: number;    // section index
    description: string;
  }>;
};

@Injectable()
export class TranscriptChunkingService {
  constructor(
    private readonly configService: ConfigService,
    private readonly aiService: AiService,  // Injected via constructor
    private readonly redisService: RedisService,
  ) {}

  // Check if chunking is needed
  needsChunking(transcriptText: string): boolean;

  // Get processing mode for a channel
  getProcessingMode(channelId: string): ProcessingMode;

  // Extract video structure before chunking
  extractStructure(transcriptText: string): Promise<VideoStructure>;

  // Split transcript into chunks at sentence boundaries
  splitIntoChunks(transcriptText: string): TranscriptChunk[];

  // Store intermediate results for recovery (job-scoped key prevents collision)
  storeChunkSummaries(transcriptionId: string, jobId: string, summaries: string[]): void;

  // Retrieve stored summaries for retry
  getStoredChunkSummaries(transcriptionId: string, jobId: string): string[] | null;

  // Clear stored summaries after successful completion
  clearChunkSummaries(transcriptionId: string, jobId: string): void;

  // Merge chunk summaries into final summary via AI
  synthesizeSummaries(summaries: string[], structure: VideoStructure): Promise<string>;

  // Main processing method
  processTranscript(
    transcriptText: string,
    transcriptionId: string,
    jobId: string,
    channelId: string,
    customPrompt?: string | null,
  ): Promise<string>;
}
```

**Processor Changes:**
```typescript
// In YoutubeTranscriptionProcessor
async processTranscriptionSummary(job: Job): Promise<{ success: boolean; message: string }> {
  const { transcriptionId, transcriptText, videoTitle, channelId } = job.data;

  // Check if chunking needed
  if (!this.chunkingService.needsChunking(transcriptText)) {
    return this.processSinglePass(transcriptionId, transcriptText, videoTitle);
  }

  // Delegate to chunking service (handles processing mode internally)
  try {
    const summary = await this.chunkingService.processTranscript(
      transcriptText,
      transcriptionId,
      job.id as string,  // Pass jobId for job-scoped Redis keys
      channelId,
      job.data.customPrompt,
    );

    await this.youtubeTranscriptionsService.updateTranscriptionSummary(
      transcriptionId,
      summary,
    );

    return { success: true, message: 'Processing complete' };
  } catch (error) {
    // Partial results are stored in Redis for retry
    throw error;
  }
}
```

**ChunkingService Main Processing Method:**
```typescript
async processTranscript(
  transcriptText: string,
  transcriptionId: string,
  jobId: string,
  channelId: string,
  customPrompt?: string | null,
): Promise<string> {
  const processingMode = this.getProcessingMode(channelId);

  // Full-context mode: single API call, truncate only if necessary
  if (processingMode === 'full-context') {
    const truncatedText = this.truncateIfNeeded(transcriptText, 120000);
    return this.aiService.callChat(
      this.configService.getTranscriptionSummaryPrompt(truncatedText, customPrompt),
    );
  }

  // Chunked mode with structure extraction
  try {
    // Step 1: Extract structure
    const structure = await this.extractStructure(transcriptText);

    // Step 2: Split into chunks
    const chunks = this.splitIntoChunks(transcriptText);
    const summaries: string[] = [];

    // Step 3: Summarize each chunk WITH structure context
    for (let i = 0; i < chunks.length; i++) {
      const summary = await this.aiService.callChat(
        this.configService.getChunkSummaryWithStructurePrompt(
          chunks[i].text,
          structure,
          i + 1,
          chunks.length,
        ),
      );

      if (!summary) {
        // Store partial results for retry
        this.storeChunkSummaries(transcriptionId, jobId, summaries);
        throw new TranscriptChunkingError(`Chunk ${i + 1} processing failed`, transcriptionId, jobId);
      }

      summaries.push(summary);
    }

    // Store summaries before synthesis
    this.storeChunkSummaries(transcriptionId, jobId, summaries);

    // Step 4: Synthesize with structure awareness
    const finalSummary = await this.synthesizeSummaries(summaries, structure);

    // Clear intermediate storage
    this.clearChunkSummaries(transcriptionId, jobId);

    return finalSummary;
  } catch (error) {
    // Fallback to simple chunking without structure extraction
    console.error('Structure-aware chunking failed, falling back to simple chunking:', error);
    return this.processSimpleChunked(transcriptText, transcriptionId, jobId);
  }
}

private async processSimpleChunked(
  transcriptText: string,
  transcriptionId: string,
  jobId: string,
): Promise<string> {
  const chunks = this.splitIntoChunks(transcriptText);
  const summaries: string[] = [];

  for (const chunk of chunks) {
    const summary = await this.aiService.callChat(
      this.configService.getChunkSummaryPrompt(chunk.text),
    );
    if (summary) {
      summaries.push(summary);
    }
  }

  return this.synthesizeSummaries(summaries, { sections: [], keyThemes: [], crossReferences: [] });
}
```

## Configuration to Add

```typescript
// config.entity.ts
type ProcessingMode = 'chunked' | 'full-context';

type YoutubeTranscriptionsConfig = {
  channels: { ... };
  maxVideosPerChannel: number;

  // Chunking config
  maxTranscriptionTokens: number;      // Soft limit before chunking (default: 100000)
  transcriptionChunkSize: number;      // Target chunk size in tokens (default: 50000)
  transcriptionChunkOverlap: number;   // Overlap in tokens (default: 500)

  // Processing mode config
  defaultProcessingMode: ProcessingMode;  // Default: 'chunked'
  fullContextChannels: string[];          // YouTube channel IDs (e.g., 'UCxxxxx') that should use full-context mode
};                                          // NOTE: These are YouTube channel IDs, NOT database IDs

// Example config:
youtubeTranscriptions: {
  channels: { ... },
  maxVideosPerChannel: 1,
  maxTranscriptionTokens: 100000,
  transcriptionChunkSize: 50000,
  transcriptionChunkOverlap: 500,
  defaultProcessingMode: 'chunked',
  fullContextChannels: [
    'UCxxxxx',  // Premium channel - gets full context processing
    'UCyyyyy',  // Another important channel
  ],
}

// config.service.ts - add validation and getters
getYoutubeTranscriptionsConfig(): YoutubeTranscriptionsConfig {
  const baseConfig = this.CONFIGS.youtubeTranscriptions;

  // Validate chunking config
  if (baseConfig.transcriptionChunkSize >= baseConfig.maxTranscriptionTokens) {
    throw new Error('transcriptionChunkSize must be less than maxTranscriptionTokens');
  }

  return baseConfig;
}

getProcessingModeForChannel(channelId: string): ProcessingMode {
  const config = this.CONFIGS.youtubeTranscriptions;
  // channelId should be the YouTube channel ID (e.g., 'UCxxxxx'), not the database ID
  if (config.fullContextChannels.includes(channelId)) {
    return 'full-context';
  }
  return config.defaultProcessingMode;
}
```

### Alternative: Database-Driven Channel Configuration

For more flexibility, store processing mode per channel in the database:

```typescript
// youtube_channels table - add column
ALTER TABLE youtube_channels ADD COLUMN processing_mode TEXT DEFAULT 'chunked';

// Updated config.service.ts
async getProcessingModeForChannel(channelId: string): Promise<ProcessingMode> {
  const channel = await this.youtubeChannelsService.getChannelById(channelId);
  return channel?.processingMode || this.CONFIGS.youtubeTranscriptions.defaultProcessingMode;
}
```

## Prompts for Structure-Aware Chunking

Add these new prompts to `src/config/prompts/transcription-summary.prompt.ts`:

**Structure Extraction Prompt:**
```typescript
export const structureExtractionPrompt = `
You are analyzing a YouTube video transcript to understand its structure.

Your task:
1. Identify the main sections/topics of this video
2. For each section, note the approximate beginning (first distinctive phrase)
3. Capture how sections relate to each other

Output format (JSON):
{
  "sections": [
    {"title": "Section title", "startPhrase": "First distinctive phrase of section"},
    ...
  ],
  "keyThemes": ["Theme 1", "Theme 2", ...],
  "crossReferences": [
    {"from": 0, "to": 3, "description": "Section 1 introduces concept used in section 4"},
    ...
  ]
}

Transcript:
{article_content}
`;
```

**Chunk Summary with Structure Context Prompt:**
```typescript
export const chunkSummaryWithStructurePrompt = `
You are summarizing section {section_number} of {total_sections} from a YouTube video.

## Video Context
Key themes: {key_themes}
Video structure: {sections_overview}

## Cross-References to This Section
{cross_references}

## This Section's Content
{chunk_content}

Provide a summary that:
1. Connects to the video's overall themes where relevant
2. Notes any references to other parts of the video
3. Preserves the speaker's key arguments and data

Output format:
**Main Points:**
- [2-3 key points from this section]

**Connections:**
- [How this section relates to others, if applicable]

**Key Data/Quotes:**
- [Notable information from this section]
`;
```

**Synthesis Prompt with Structure:**
```typescript
export const synthesisWithStructurePrompt = `
You are creating a final summary from multiple section summaries of a YouTube video.

## Video Structure
{video_structure}

## Section Summaries
{chunk_summaries}

Create a coherent summary that:
1. Maintains the logical flow of the original video
2. Connects related points across sections
3. Preserves the speaker's main arguments and supporting evidence
4. Includes key data points and memorable quotes

Output format:
1) 3-5 sentence overview in plain English
2) 3-5 sentence summary in technical terms
3) Key takeaways as concise bullet points
4) Notable data, trends, or memorable quotes
5) Brief critique: any bias, outdated information, or gaps
`;
```

## Error Handling for Partial Failures

| Failure Point | Recovery Strategy |
|---------------|-------------------|
| Chunk N summary fails | Store N-1 successful summaries; retry chunk N on next job attempt |
| Synthesis fails | Retrieve stored chunk summaries; retry synthesis only |
| Job timeout | Intermediate summaries persisted; can resume from last successful chunk |
| All chunks succeed, DB update fails | Summaries stored separately; manual recovery possible |

**Storage Strategy:** Use Redis with TTL for intermediate chunk summaries:
```typescript
// Key: `transcript:chunk:${transcriptionId}:${jobId}`
// Value: JSON array of chunk summaries
// TTL: 24 hours
//
// IMPORTANT: Include the jobId in the key to:
// - Prevent collision when the same transcription is processed multiple times concurrently
// - Enable debugging of specific job executions
// - Allow safe retry without overwriting previous attempt's partial results
```

## Logging and Observability

Add structured logging for chunking operations:
```typescript
console.log(JSON.stringify({
  event: 'transcript_chunking_start',
  transcriptionId,
  totalTokens: estimatedTokens,
  chunkCount: chunks.length,
  videoTitle
}));

console.log(JSON.stringify({
  event: 'chunk_processed',
  transcriptionId,
  chunkIndex: i,
  chunkTokens: chunk.tokenCount,
  processingTimeMs: endTime - startTime
}));

console.log(JSON.stringify({
  event: 'transcript_chunking_complete',
  transcriptionId,
  totalApiCalls: chunks.length + 1, // chunks + synthesis
  totalTokensProcessed,
  totalProcessingTimeMs
}));
```

## Verification

1. **Unit Tests:**
   - Test token estimation accuracy for chat models
   - Test chunking splits at sentence boundaries (not mid-sentence)
   - Test overlap calculation preserves context
   - Test intermediate storage and retrieval in Redis
   - Test structure extraction JSON parsing (valid and malformed)
   - Test processing mode resolution for channels
   - Test synthesis prompt formatting with structure

2. **Integration Tests:**
   - Process a short transcript (<100K tokens) - verify single-pass
   - Process a long transcript with chunked mode - verify structure extraction + chunking
   - Process a long transcript with full-context mode - verify no chunking
   - Simulate chunk failure - verify partial results stored
   - Simulate synthesis failure - verify retry uses stored summaries
   - Simulate structure extraction failure - verify fallback to simple chunking
   - Verify final summaries are coherent and preserve cross-references

3. **Manual Testing:**
   - Use the transcript from `transcript-1.txt` (the Theo Browne video that exposed this issue)
   - Create a synthetic very-long transcript (3+ hours) to test chunking
   - Compare summary quality between:
     - Simple chunking
     - Structure-aware chunking
     - Full-context mode
   - Verify cost tracking via logs
   - Test cross-reference preservation (videos with "as I mentioned earlier..." patterns)

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Chunking loses cross-chunk context | Medium (was High) | Structure extraction before chunking; pass structure to chunk summaries |
| Multiple API calls increase cost | High | Log token usage; make thresholds configurable; +1 API call for structure extraction |
| Synthesis produces incoherent results | Low (was Medium) | Synthesis prompt includes full structure; cross-references preserved |
| API rate limits during multi-chunk processing | Medium | Add delay between chunk API calls; reuse existing retry logic |
| Job timeout for 3+ hour videos | High | Increase BullMQ job timeout; add progress heartbeat |
| Breaking change to existing summaries | Low | Changes are additive; no existing behavior modified |
| Structure extraction fails | Low | Fallback to simple chunking without structure |
| Full-context mode truncates important content | Low | Only used for configured premium channels; logs warning on truncation |
| JSON parsing fails for structure output | Medium | Use robust parsing; fallback to simple chunking on parse error |

## Cost Comparison

| Processing Mode | API Calls | Use Case |
|-----------------|-----------|----------|
| Single-pass (short video) | 1 | Videos under 100K tokens |
| Simple chunking (4 chunks) | 5 | Fallback when structure extraction fails |
| Structure-aware chunking (4 chunks) | 6 | Standard long videos |
| Full-context | 1 | Premium channels (may truncate) |

## Migration Plan

1. **Phase 1: Add infrastructure** (no behavior change)
   - Create shared `token-estimation.ts` helper in `src/shared/helpers/`
   - Update `AiService` to use shared helper
   - Create `TranscriptChunkingService` with stub methods
   - Add config options with defaults that disable chunking
   - Add prompts for structure extraction and chunking

2. **Phase 2: Implement core chunking logic**
   - Implement token estimation using shared helper
   - Implement chunk splitting with sentence boundaries
   - Implement intermediate storage in Redis
   - Add simple synthesis (without structure)

3. **Phase 3: Add structure-aware processing**
   - Implement structure extraction prompt and parsing
   - Update chunk summary prompt to include structure context
   - Update synthesis prompt to use structure
   - Add fallback to simple chunking

4. **Phase 4: Add processing mode configuration**
   - Implement channel-level processing mode (config or database)
   - Add full-context mode for premium channels
   - Add configuration UI/admin endpoint (optional)

5. **Phase 5: Wire up processor**
   - Update processor to use chunking service
   - Add logging/metrics for each processing mode
   - Enable via config
   - Test with real transcripts

6. **Phase 6: Monitor and tune**
   - Watch logs for chunking frequency
   - Compare summary quality between modes
   - Tune thresholds based on real usage
   - Adjust prompts based on output quality
   - Monitor API costs per processing mode