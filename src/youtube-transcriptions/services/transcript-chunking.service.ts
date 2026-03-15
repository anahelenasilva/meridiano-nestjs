import { RedisService } from '@libs/redis';
import { Injectable } from '@nestjs/common';
import { AiService } from '../../ai/ai.service';
import { ProcessingMode } from '../../config/config.entity';
import { ConfigService } from '../../config/config.service';
import {
  chunkSummaryPrompt,
  chunkSummaryWithStructurePrompt,
  structureExtractionPrompt,
  synthesisWithStructurePrompt,
  transcriptionSummaryPrompt,
} from '../../config/prompts';
import { buildFinalPrompt } from '../../shared/helpers/build-final-prompt';
import { estimateChatTokens } from '../../shared/helpers/token-estimation';
import {
  StructureExtractionError,
  TranscriptChunkingError,
} from '../errors/transcript-chunking.errors';

export type VideoStructure = {
  sections: Array<{
    title: string;
    startPhrase: string;
  }>;
  keyThemes: string[];
  crossReferences: Array<{
    from: number;
    to: number;
    description: string;
  }>;
};

export type TranscriptChunk = {
  text: string;
  tokenCount: number;
  startIndex: number;
};

const REDIS_KEY_PREFIX = 'transcript:chunk';
const REDIS_TTL_SECONDS = 24 * 60 * 60; // 24 hours

@Injectable()
export class TranscriptChunkingService {
  constructor(
    private readonly configService: ConfigService,
    private readonly aiService: AiService,
    private readonly redisService: RedisService,
  ) { }

  needsChunking(transcriptText: string): boolean {
    const config = this.configService.getYoutubeTranscriptionsChunkingConfig();
    const tokenCount = estimateChatTokens(transcriptText);
    return tokenCount > config.maxTranscriptionTokens;
  }

  getProcessingMode(channelId: string): ProcessingMode {
    return this.configService.getProcessingModeForChannel(channelId);
  }

  async extractStructure(
    transcriptText: string,
    transcriptionId: string,
  ): Promise<VideoStructure> {
    // Truncate for structure extraction to avoid API limits
    // Structure extraction only needs themes and section markers, not full content
    const truncatedText = this.truncateIfNeeded(transcriptText, 50000);

    const prompt = structureExtractionPrompt.replace(
      '{article_content}',
      truncatedText,
    );

    const response = await this.aiService.callChat(prompt);

    if (!response) {
      throw new StructureExtractionError(
        'Structure extraction returned empty response',
        transcriptionId,
      );
    }

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new StructureExtractionError(
          'No JSON object found in response',
          transcriptionId,
          response,
        );
      }

      const parsed = JSON.parse(jsonMatch[0]) as VideoStructure;

      if (!parsed.sections || !Array.isArray(parsed.sections)) {
        throw new StructureExtractionError(
          'Invalid structure: missing or invalid sections array',
          transcriptionId,
          response,
        );
      }

      return {
        sections: parsed.sections || [],
        keyThemes: parsed.keyThemes || [],
        crossReferences: parsed.crossReferences || [],
      };
    } catch (error) {
      if (error instanceof StructureExtractionError) {
        throw error;
      }
      throw new StructureExtractionError(
        `Failed to parse structure JSON: ${error instanceof Error ? error.message : String(error)}`,
        transcriptionId,
        response,
      );
    }
  }

  splitIntoChunks(transcriptText: string): TranscriptChunk[] {
    const config = this.configService.getYoutubeTranscriptionsChunkingConfig();
    const chunkSize = config.transcriptionChunkSize;
    const overlap = config.transcriptionChunkOverlap;

    const normalizedText = transcriptText.trim().replace(/\s+/g, ' ');
    if (!normalizedText) {
      return [];
    }

    const totalTokens = estimateChatTokens(normalizedText);
    if (totalTokens <= chunkSize) {
      return [
        {
          text: normalizedText,
          tokenCount: totalTokens,
          startIndex: 0,
        },
      ];
    }

    const sentences = normalizedText.split(/(?<=[.!?])\s+/);
    const chunks: TranscriptChunk[] = [];
    let currentChunk = '';
    let currentTokens = 0;
    let startIndex = 0;

    for (const sentence of sentences) {
      const sentenceTokens = estimateChatTokens(sentence);
      const candidate = currentChunk ? `${currentChunk} ${sentence}` : sentence;
      const candidateTokens = estimateChatTokens(candidate);

      if (candidateTokens <= chunkSize) {
        currentChunk = candidate;
        currentTokens = candidateTokens;
        continue;
      }

      if (currentChunk) {
        chunks.push({
          text: currentChunk,
          tokenCount: currentTokens,
          startIndex,
        });

        // Add overlap from the end of the previous chunk
        const overlapText = this.getOverlapText(currentChunk, overlap);
        currentChunk = overlapText ? `${overlapText} ${sentence}` : sentence;
        currentTokens = estimateChatTokens(currentChunk);
        startIndex = chunks.length;
      } else {
        // Single sentence exceeds chunk size, use it anyway
        currentChunk = sentence;
        currentTokens = sentenceTokens;
        startIndex = chunks.length;
      }
    }

    if (currentChunk) {
      chunks.push({
        text: currentChunk,
        tokenCount: currentTokens,
        startIndex,
      });
    }

    return chunks;
  }

  private getOverlapText(text: string, overlapTokens: number): string {
    const tokens = estimateChatTokens(text);
    if (tokens <= overlapTokens) {
      return text;
    }

    // Approximate character position for overlap
    const charsPerToken = text.length / tokens;
    const overlapChars = Math.floor(overlapTokens * charsPerToken);

    // Find sentence boundary near the overlap point
    const startPos = Math.max(0, text.length - overlapChars);
    const substring = text.substring(startPos);
    const sentenceStart = substring.indexOf('. ');

    if (sentenceStart !== -1) {
      return substring.substring(sentenceStart + 2);
    }

    return substring;
  }

  private getRedisKey(transcriptionId: string, jobId: string): string {
    return `${REDIS_KEY_PREFIX}:${transcriptionId}:${jobId}`;
  }

  async storeChunkSummaries(
    transcriptionId: string,
    jobId: string,
    summaries: string[],
  ): Promise<void> {
    const key = this.getRedisKey(transcriptionId, jobId);
    const client = this.redisService.getClient();
    await client.setex(key, REDIS_TTL_SECONDS, JSON.stringify(summaries));
  }

  async getStoredChunkSummaries(
    transcriptionId: string,
    jobId: string,
  ): Promise<string[] | null> {
    const key = this.getRedisKey(transcriptionId, jobId);
    const client = this.redisService.getClient();
    const data = await client.get(key);

    if (!data) {
      return null;
    }

    try {
      return JSON.parse(data) as string[];
    } catch {
      return null;
    }
  }

  async clearChunkSummaries(
    transcriptionId: string,
    jobId: string,
  ): Promise<void> {
    const key = this.getRedisKey(transcriptionId, jobId);
    const client = this.redisService.getClient();
    await client.del(key);
  }

  async synthesizeSummaries(
    summaries: string[],
    structure: VideoStructure,
    transcriptionId: string,
    jobId: string,
    customPrompt?: string | null,
  ): Promise<string> {
    const sectionsOverview = structure.sections
      .map((s, i) => `${i + 1}. ${s.title}`)
      .join('\n');

    const videoStructure = `Key Themes: ${structure.keyThemes.join(', ')}\nSections:\n${sectionsOverview}`;

    const chunkSummaries = summaries
      .map((s, i) => `## Section ${i + 1}\n${s}`)
      .join('\n\n');

    const basePrompt = synthesisWithStructurePrompt
      .replace('{video_structure}', videoStructure)
      .replace('{chunk_summaries}', chunkSummaries);

    const prompt = buildFinalPrompt(basePrompt, customPrompt);

    const result = await this.aiService.callChat(prompt);

    if (!result) {
      throw new TranscriptChunkingError(
        'Synthesis returned empty response',
        transcriptionId,
        jobId,
      );
    }

    return result;
  }

  private truncateIfNeeded(
    transcriptText: string,
    maxTokens: number,
  ): string {
    const tokens = estimateChatTokens(transcriptText);
    if (tokens <= maxTokens) {
      return transcriptText;
    }

    // Approximate character position
    const charsPerToken = transcriptText.length / tokens;
    const targetChars = Math.floor(maxTokens * charsPerToken);

    // Find sentence boundary near the target
    const truncated = transcriptText.substring(0, targetChars);
    const lastSentenceEnd = Math.max(
      truncated.lastIndexOf('. '),
      truncated.lastIndexOf('! '),
      truncated.lastIndexOf('? '),
    );

    if (lastSentenceEnd > targetChars * 0.8) {
      return truncated.substring(0, lastSentenceEnd + 1);
    }

    return truncated;
  }

  async processTranscript(
    transcriptText: string,
    transcriptionId: string,
    jobId: string,
    channelId: string,
    customPrompt?: string | null,
  ): Promise<string> {
    const processingMode = this.getProcessingMode(channelId);

    if (processingMode === 'full-context') {
      console.log(
        JSON.stringify({
          event: 'transcript_full_context_start',
          transcriptionId,
          processingMode,
        }),
      );

      const truncatedText = this.truncateIfNeeded(transcriptText, 120000);
      const basePrompt = transcriptionSummaryPrompt.replace(
        '{article_content}',
        truncatedText,
      );
      const prompt = buildFinalPrompt(basePrompt, customPrompt);

      const result = await this.aiService.callChat(prompt);

      if (!result) {
        throw new TranscriptChunkingError(
          'Full-context processing returned empty response',
          transcriptionId,
          jobId,
        );
      }

      return result;
    }

    // Chunked mode with structure extraction
    console.log(
      JSON.stringify({
        event: 'transcript_chunking_start',
        transcriptionId,
        processingMode,
        estimatedTokens: estimateChatTokens(transcriptText),
      }),
    );

    try {
      // Step 1: Extract structure
      const structure = await this.extractStructure(
        transcriptText,
        transcriptionId,
      );

      console.log(
        JSON.stringify({
          event: 'transcript_structure_extracted',
          transcriptionId,
          sectionsCount: structure.sections.length,
          keyThemesCount: structure.keyThemes.length,
        }),
      );

      // Step 2: Split into chunks
      const chunks = this.splitIntoChunks(transcriptText);
      const summaries: string[] = [];

      console.log(
        JSON.stringify({
          event: 'transcript_chunks_created',
          transcriptionId,
          chunkCount: chunks.length,
          chunkSizes: chunks.map((c) => c.tokenCount),
        }),
      );

      // Step 3: Summarize each chunk WITH structure context
      for (let i = 0; i < chunks.length; i++) {
        const startTime = Date.now();
        const chunk = chunks[i];

        const sectionsOverview = structure.sections
          .map((s, idx) => `${idx + 1}. ${s.title}`)
          .join('\n');

        const relevantCrossRefs = structure.crossReferences
          .filter(
            (cr) =>
              cr.from === i ||
              cr.to === i ||
              (cr.from <= i && cr.to >= i),
          )
          .map((cr) => cr.description)
          .join('\n');

        const baseChunkPrompt = chunkSummaryWithStructurePrompt
          .replace('{section_number}', String(i + 1))
          .replace('{total_sections}', String(chunks.length))
          .replace('{key_themes}', structure.keyThemes.join(', '))
          .replace('{sections_overview}', sectionsOverview)
          .replace('{cross_references}', relevantCrossRefs || 'None')
          .replace('{chunk_content}', chunk.text);

        const prompt = buildFinalPrompt(baseChunkPrompt, customPrompt);

        const summary = await this.aiService.callChat(prompt);

        if (!summary) {
          // Store partial results for retry
          await this.storeChunkSummaries(transcriptionId, jobId, summaries);
          throw new TranscriptChunkingError(
            `Chunk ${i + 1} processing failed`,
            transcriptionId,
            jobId,
          );
        }

        summaries.push(summary);

        console.log(
          JSON.stringify({
            event: 'transcript_chunk_processed',
            transcriptionId,
            chunkIndex: i,
            chunkTokens: chunk.tokenCount,
            processingTimeMs: Date.now() - startTime,
          }),
        );
      }

      // Store summaries before synthesis
      await this.storeChunkSummaries(transcriptionId, jobId, summaries);

      // Step 4: Synthesize with structure awareness
      const finalSummary = await this.synthesizeSummaries(
        summaries,
        structure,
        transcriptionId,
        jobId,
        customPrompt,
      );

      // Clear intermediate storage
      await this.clearChunkSummaries(transcriptionId, jobId);

      console.log(
        JSON.stringify({
          event: 'transcript_chunking_complete',
          transcriptionId,
          chunkCount: chunks.length,
        }),
      );

      return finalSummary;
    } catch (error) {
      if (error instanceof TranscriptChunkingError) {
        throw error;
      }

      // Fallback to simple chunking without structure extraction
      console.error(
        'Structure-aware chunking failed, falling back to simple chunking:',
        error,
      );
      return this.processSimpleChunked(
        transcriptText,
        transcriptionId,
        jobId,
        customPrompt,
      );
    }
  }

  private async processSimpleChunked(
    transcriptText: string,
    transcriptionId: string,
    jobId: string,
    customPrompt?: string | null,
  ): Promise<string> {
    const chunks = this.splitIntoChunks(transcriptText);
    const summaries: string[] = [];

    console.log(
      JSON.stringify({
        event: 'transcript_simple_chunking_start',
        transcriptionId,
        chunkCount: chunks.length,
      }),
    );

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const baseChunkPrompt = chunkSummaryPrompt.replace('{chunk_content}', chunk.text);
      const prompt = buildFinalPrompt(baseChunkPrompt, customPrompt);

      const summary = await this.aiService.callChat(prompt);

      if (!summary) {
        // Store partial results for retry
        await this.storeChunkSummaries(transcriptionId, jobId, summaries);
        throw new TranscriptChunkingError(
          `Simple chunk ${i + 1} processing failed`,
          transcriptionId,
          jobId,
        );
      }

      summaries.push(summary);

      console.log(
        JSON.stringify({
          event: 'transcript_simple_chunk_processed',
          transcriptionId,
          chunkIndex: i,
        }),
      );
    }

    const result = await this.synthesizeSummaries(
      summaries,
      {
        sections: [],
        keyThemes: [],
        crossReferences: [],
      },
      transcriptionId,
      jobId,
      customPrompt,
    );

    await this.clearChunkSummaries(transcriptionId, jobId);

    return result;
  }
}
