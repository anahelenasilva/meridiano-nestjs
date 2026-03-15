# Transcript Chunking for Long Videos

## Overview

This feature handles YouTube transcripts that exceed DeepSeek model context limits. It implements a hybrid processing strategy with structure-aware chunking to preserve context across transcript sections while staying within API limits.

## Problem Statement

YouTube transcripts can vary widely in length:
- **Short videos (5-10 min)**: ~1,000-3,000 words (~1,500-4,500 tokens)
- **Medium videos (15-30 min)**: ~3,000-8,000 words (~4,500-12,000 tokens)
- **Long videos (1+ hour)**: ~10,000-20,000+ words (~15,000-30,000+ tokens)

While DeepSeek's 128K context window is generous, extremely long transcripts (multi-hour content) could approach or exceed this limit when combined with prompts. Previously, transcripts were silently truncated to 8,000 characters, causing content loss.

## Solution

A hybrid approach with two processing modes:

1. **Full-Context Mode**: For premium/high-priority channels, process the entire transcript without chunking (truncates only if exceeding absolute limits)

2. **Chunked Mode** (default): Structure-aware chunking that:
   - Extracts video structure before splitting
   - Splits at sentence boundaries with overlap
   - Summarizes each chunk with structure context
   - Synthesizes a final unified summary

## Architecture

```
Transcript
    │
    ▼
Token Estimation
    │
    ├── Under 100K tokens → Single API call → Summary
    │
    └── Over 100K tokens → Get Processing Mode
                              │
                              ├── FULL-CONTEXT → Single API call (truncate if > 120K)
                              │
                              └── CHUNKED (default)
                                    │
                                    ▼
                              1. Extract video structure (1 API call)
                              │
                                    ▼
                              2. Split into overlapping chunks
                              │
                                    ▼
                              3. Summarize each chunk WITH structure context
                              │
                                    ▼
                              4. Store summaries in Redis (for recovery)
                              │
                                    ▼
                              5. Synthesize summaries into final output
```

## Configuration

### Configuration Options

Add these options to your configuration or use the defaults:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxTranscriptionTokens` | number | 100000 | Token threshold that triggers chunking |
| `transcriptionChunkSize` | number | 50000 | Target size for each chunk in tokens |
| `transcriptionChunkOverlap` | number | 500 | Overlap between chunks in tokens |
| `defaultProcessingMode` | 'chunked' \| 'full-context' | 'chunked' | Default processing mode |
| `fullContextChannels` | string[] | [] | YouTube channel IDs that use full-context mode |

### Default Configuration

The feature works out of the box with sensible defaults defined in `config.service.ts`:

```typescript
youtubeTranscriptions: {
  channels: {},
  maxVideosPerChannel: 1,
  maxTranscriptionTokens: 100000,      // ~75K words
  transcriptionChunkSize: 50000,       // ~37K words per chunk
  transcriptionChunkOverlap: 500,      // ~375 words overlap
  defaultProcessingMode: 'chunked',
  fullContextChannels: [],
}
```

### Enabling Full-Context Mode for Premium Channels

To give specific channels full-context processing (no chunking), add their YouTube channel IDs:

```typescript
youtubeTranscriptions: {
  // ... other config
  fullContextChannels: [
    'UCxxxxx',  // Premium channel ID
    'UCyyyyy',  // Another important channel
  ],
}
```

**Note**: Use YouTube channel IDs (e.g., `UCxxxxx`), NOT database IDs.

## Processing Modes

### Chunked Mode (Default)

Best for most use cases. Uses structure-aware chunking to handle arbitrarily long transcripts.

**Flow:**
1. **Structure Extraction**: AI analyzes transcript to identify sections, themes, and cross-references
2. **Chunking**: Split transcript at sentence boundaries with overlap
3. **Chunk Summarization**: Each chunk is summarized with structure context
4. **Synthesis**: All chunk summaries are combined into final output

**API Calls:** N+2 calls (1 structure + N chunks + 1 synthesis)

### Full-Context Mode

For premium channels where quality is paramount. Processes entire transcript in one call.

**Flow:**
1. Single API call with full transcript
2. Truncates only if exceeding 120K tokens

**API Calls:** 1 call

## Error Handling

### Partial Failure Recovery

When chunk processing fails, intermediate results are stored in Redis for retry:

| Failure Point | Recovery Strategy |
|---------------|-------------------|
| Chunk N summary fails | Store N-1 successful summaries; retry chunk N |
| Synthesis fails | Retrieve stored chunk summaries; retry synthesis only |
| Job timeout | Intermediate summaries persisted in Redis |
| Structure extraction fails | Fallback to simple chunking (no structure context) |

### Redis Storage

Intermediate summaries are stored with:
- **Key pattern**: `transcript:chunk:{transcriptionId}:{jobId}`
- **TTL**: 24 hours
- **Format**: JSON array of chunk summaries

## Logging and Observability

The feature emits structured JSON logs for monitoring:

```json
// Chunking starts
{"event":"transcript_chunking_start","transcriptionId":"abc123","processingMode":"chunked","estimatedTokens":150000}

// Structure extracted
{"event":"transcript_structure_extracted","transcriptionId":"abc123","sectionsCount":5,"keyThemesCount":3}

// Chunks created
{"event":"transcript_chunks_created","transcriptionId":"abc123","chunkCount":3,"chunkSizes":[45000,48000,42000]}

// Each chunk processed
{"event":"transcript_chunk_processed","transcriptionId":"abc123","chunkIndex":0,"chunkTokens":45000,"processingTimeMs":2340}

// Complete
{"event":"transcript_chunking_complete","transcriptionId":"abc123","chunkCount":3}
```

## Files Created/Modified

### New Files

| File | Purpose |
|------|---------|
| `src/shared/helpers/token-estimation.ts` | Shared token estimation utility |
| `src/youtube-transcriptions/services/transcript-chunking.service.ts` | Main chunking service |
| `src/youtube-transcriptions/errors/transcript-chunking.errors.ts` | Custom error types |

### Modified Files

| File | Changes |
|------|---------|
| `src/config/config.entity.ts` | Added `ProcessingMode` type and chunking config |
| `src/config/config.service.ts` | Added chunking config getters |
| `src/config/prompts/transcription-summary.prompt.ts` | Added chunking prompts |
| `src/ai/ai.service.ts` | Uses shared token estimation helper |
| `src/youtube-transcriptions/processors/youtube-transcription.processor.ts` | Integrated chunking service |
| `src/youtube-transcriptions/youtube-transcriptions.module.ts` | Registered chunking service |
| `libs/queue/interfaces/youtube-transcription-job.interface.ts` | Added `channelId` |
| `libs/queue/queue.service.ts` | Updated job enqueue method |
| `src/youtube-transcriptions/services/youtube-transcriptions.service.ts` | Passes `channelId` to queue |

## Prompts

The feature uses four specialized prompts:

### 1. Structure Extraction Prompt

Analyzes transcript to identify sections, themes, and cross-references. Outputs JSON.

### 2. Chunk Summary with Structure Prompt

Summarizes individual chunks with:
- Video context (key themes, structure)
- Cross-references to this section
- Section content

### 3. Synthesis Prompt

Combines chunk summaries into coherent final output with:
- Video structure context
- All chunk summaries
- Final summary format (overview, technical summary, takeaways, quotes, critique)

### 4. Simple Chunk Summary Prompt (Fallback)

Used when structure extraction fails. Summarizes without context.

## Cost Implications

| Processing Mode | API Calls | Use Case |
|-----------------|-----------|----------|
| Single-pass (short video) | 1 | Videos under 100K tokens |
| Structure-aware chunking (4 chunks) | 6 | Standard long videos |
| Simple chunking (4 chunks) | 5 | Fallback when structure fails |
| Full-context | 1 | Premium channels |

## Testing

### Unit Tests

The existing test suite covers:
- Token estimation accuracy
- Chunk splitting at sentence boundaries
- Overlap calculation
- Processing mode resolution
- Structure extraction JSON parsing

### Manual Testing

To test with a real transcript:

```bash
# Submit a long video for processing
curl -X POST http://localhost:3000/api/youtube-transcriptions/process \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "videoUrl": "https://www.youtube.com/watch?v=LONG_VIDEO_ID",
    "channelId": "your-channel-id"
  }'
```

Monitor logs for chunking events:
```bash
# Watch for chunking logs
docker-compose logs -f app | grep "transcript_chunking"
```

## Troubleshooting

### "Transcript exceeds token limit" warnings

This is expected for long videos. The system will use chunked processing automatically.

### Chunk processing fails

Check Redis connectivity. Partial results are stored for retry:
```bash
# Check Redis for stored summaries
redis-cli GET "transcript:chunk:{transcriptionId}:{jobId}"
```

### Structure extraction returns malformed JSON

The system falls back to simple chunking automatically. Check logs for the raw AI output.

### High API costs

If costs are a concern:
1. Increase `maxTranscriptionTokens` to reduce chunking frequency
2. Use `fullContextChannels` sparingly
3. Consider using a cheaper model for chunk summarization

## Future Improvements

1. **Database-driven channel config**: Store processing mode per channel in the database
2. **Adaptive chunk sizing**: Adjust chunk size based on content type
3. **Parallel chunk processing**: Process chunks concurrently for faster throughput
4. **Cost tracking**: Log token usage per processing mode for cost analysis