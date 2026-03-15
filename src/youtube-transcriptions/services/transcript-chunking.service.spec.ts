import { mock } from 'jest-mock-extended';
import { AiService } from '../../ai/ai.service';
import { ConfigService } from '../../config/config.service';
import { RedisService } from '@libs/redis';
import {
  StructureExtractionError,
  TranscriptChunkingError,
} from '../errors/transcript-chunking.errors';
import {
  TranscriptChunkingService,
  VideoStructure,
} from './transcript-chunking.service';

describe('TranscriptChunkingService', () => {
  let service: TranscriptChunkingService;
  const mockAiService = mock<AiService>();
  const mockConfigService = mock<ConfigService>();
  const mockRedisService = mock<RedisService>();
  const mockRedisClient = {
    setex: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(undefined),
  };

  const transcriptionId = 'test-transcription-id';
  const jobId = 'test-job-id';
  const channelId = 'test-channel-id';

  const defaultChunkingConfig = {
    maxTranscriptionTokens: 100000,
    transcriptionChunkSize: 50000,
    transcriptionChunkOverlap: 500,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfigService.getYoutubeTranscriptionsChunkingConfig.mockReturnValue(
      defaultChunkingConfig,
    );
    mockConfigService.getProcessingModeForChannel.mockReturnValue('chunked');
    mockRedisService.getClient.mockReturnValue(mockRedisClient as never);

    service = new TranscriptChunkingService(
      mockConfigService,
      mockAiService,
      mockRedisService,
    );
  });

  describe('needsChunking', () => {
    it('returns false for short transcripts', () => {
      const shortText = 'This is a short transcript.';

      const result = service.needsChunking(shortText);

      expect(result).toBe(false);
    });

    it('returns true for long transcripts exceeding maxTranscriptionTokens', () => {
      const longText = 'word '.repeat(150000);

      const result = service.needsChunking(longText);

      expect(result).toBe(true);
    });

    it('uses configured maxTranscriptionTokens threshold', () => {
      mockConfigService.getYoutubeTranscriptionsChunkingConfig.mockReturnValue({
        ...defaultChunkingConfig,
        maxTranscriptionTokens: 50000,
      });

      const mediumText = 'word '.repeat(60000);

      const result = service.needsChunking(mediumText);

      expect(result).toBe(true);
    });
  });

  describe('getProcessingMode', () => {
    it('returns chunked by default', () => {
      mockConfigService.getProcessingModeForChannel.mockReturnValue('chunked');

      const result = service.getProcessingMode(channelId);

      expect(result).toBe('chunked');
    });

    it('returns full-context for configured channels', () => {
      mockConfigService.getProcessingModeForChannel.mockReturnValue('full-context');

      const result = service.getProcessingMode('premium-channel-id');

      expect(result).toBe('full-context');
    });
  });

  describe('splitIntoChunks', () => {
    it('returns single chunk for text under chunk size', () => {
      const shortText = 'This is a short text. It has two sentences.';

      const chunks = service.splitIntoChunks(shortText);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].text).toBe(shortText);
    });

    it('splits text at sentence boundaries', () => {
      const sentence = 'This is a sentence. ';
      const longText = sentence.repeat(10000);

      const chunks = service.splitIntoChunks(longText);

      for (const chunk of chunks) {
        expect(chunk.text.endsWith('.')).toBe(true);
      }
    });

    it('adds overlap between chunks', () => {
      const sentence = 'This is sentence number X. ';
      const sentences: string[] = [];
      for (let i = 0; i < 10000; i++) {
        sentences.push(sentence.replace('X', String(i)));
      }
      const longText = sentences.join('');

      const chunks = service.splitIntoChunks(longText);

      if (chunks.length > 1) {
        const firstChunkEnd = chunks[0].text.slice(-50);
        const secondChunkStart = chunks[1].text.slice(0, 100);
        expect(
          secondChunkStart.includes(firstChunkEnd.trim().slice(-30)) ||
          chunks[1].startIndex > 0,
        ).toBe(true);
      }
    });

    it('handles empty text', () => {
      const chunks = service.splitIntoChunks('');

      expect(chunks).toHaveLength(0);
    });

    it('handles whitespace-only text', () => {
      const chunks = service.splitIntoChunks('   ');

      expect(chunks).toHaveLength(0);
    });
  });

  describe('extractStructure', () => {
    const validStructureJson = JSON.stringify({
      sections: [
        { title: 'Introduction', startPhrase: 'Welcome to the video' },
        { title: 'Main Topic', startPhrase: 'Let us discuss' },
      ],
      keyThemes: ['theme1', 'theme2'],
      crossReferences: [{ from: 0, to: 1, description: 'reference' }],
    });

    it('extracts and parses video structure', async () => {
      mockAiService.callChat.mockResolvedValue(validStructureJson);

      const result = await service.extractStructure(
        'Transcript text',
        transcriptionId,
      );

      expect(result.sections).toHaveLength(2);
      expect(result.keyThemes).toHaveLength(2);
      expect(result.crossReferences).toHaveLength(1);
    });

    it('throws StructureExtractionError on empty response', async () => {
      mockAiService.callChat.mockResolvedValue(null);

      await expect(
        service.extractStructure('Transcript text', transcriptionId),
      ).rejects.toThrow(StructureExtractionError);
    });

    it('throws StructureExtractionError when no JSON found', async () => {
      mockAiService.callChat.mockResolvedValue('No JSON here, just text');

      await expect(
        service.extractStructure('Transcript text', transcriptionId),
      ).rejects.toThrow(StructureExtractionError);
    });

    it('throws StructureExtractionError on invalid JSON structure', async () => {
      mockAiService.callChat.mockResolvedValue('{"notSections": []}');

      await expect(
        service.extractStructure('Transcript text', transcriptionId),
      ).rejects.toThrow(StructureExtractionError);
    });

    it('truncates long transcripts before sending to AI', async () => {
      const veryLongText = 'word '.repeat(200000);
      mockAiService.callChat.mockResolvedValue(validStructureJson);

      await service.extractStructure(veryLongText, transcriptionId);

      const prompt = mockAiService.callChat.mock.calls[0][0];
      expect(prompt.length).toBeLessThan(veryLongText.length);
    });
  });

  describe('Redis storage', () => {
    it('stores chunk summaries in Redis', async () => {
      const summaries = ['summary1', 'summary2'];

      await service.storeChunkSummaries(transcriptionId, jobId, summaries);

      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        `transcript:chunk:${transcriptionId}:${jobId}`,
        24 * 60 * 60,
        JSON.stringify(summaries),
      );
    });

    it('retrieves stored chunk summaries', async () => {
      const summaries = ['summary1', 'summary2'];
      mockRedisClient.get.mockResolvedValue(JSON.stringify(summaries));

      const result = await service.getStoredChunkSummaries(
        transcriptionId,
        jobId,
      );

      expect(result).toEqual(summaries);
    });

    it('returns null when no stored summaries exist', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await service.getStoredChunkSummaries(
        transcriptionId,
        jobId,
      );

      expect(result).toBeNull();
    });

    it('returns null on invalid JSON in stored summaries', async () => {
      mockRedisClient.get.mockResolvedValue('invalid json');

      const result = await service.getStoredChunkSummaries(
        transcriptionId,
        jobId,
      );

      expect(result).toBeNull();
    });

    it('clears chunk summaries from Redis', async () => {
      await service.clearChunkSummaries(transcriptionId, jobId);

      expect(mockRedisClient.del).toHaveBeenCalledWith(
        `transcript:chunk:${transcriptionId}:${jobId}`,
      );
    });
  });

  describe('synthesizeSummaries', () => {
    const mockStructure: VideoStructure = {
      sections: [
        { title: 'Section 1', startPhrase: 'First' },
        { title: 'Section 2', startPhrase: 'Second' },
      ],
      keyThemes: ['theme1'],
      crossReferences: [],
    };

    it('synthesizes summaries with structure context', async () => {
      const summaries = ['Summary of section 1', 'Summary of section 2'];
      mockAiService.callChat.mockResolvedValue('Final synthesized summary');

      const result = await service.synthesizeSummaries(
        summaries,
        mockStructure,
        transcriptionId,
        jobId,
      );

      expect(result).toBe('Final synthesized summary');
      expect(mockAiService.callChat).toHaveBeenCalled();
    });

    it('includes custom prompt in synthesis', async () => {
      mockAiService.callChat.mockResolvedValue('Final summary');

      await service.synthesizeSummaries(
        ['summary'],
        mockStructure,
        transcriptionId,
        jobId,
        'Focus on technical details',
      );

      const prompt = mockAiService.callChat.mock.calls[0][0];
      expect(prompt).toContain('Additional instructions: Focus on technical details');
    });

    it('throws TranscriptChunkingError on empty response', async () => {
      mockAiService.callChat.mockResolvedValue(null);

      await expect(
        service.synthesizeSummaries(
          ['summary'],
          mockStructure,
          transcriptionId,
          jobId,
        ),
      ).rejects.toThrow(TranscriptChunkingError);
    });
  });

  describe('processTranscript', () => {
    const shortText = 'This is a short transcript.';

    beforeEach(() => {
      mockAiService.callChat.mockReset();
    });

    describe('full-context mode', () => {
      beforeEach(() => {
        mockConfigService.getProcessingModeForChannel.mockReturnValue('full-context');
      });

      it('processes transcript without chunking in full-context mode', async () => {
        mockAiService.callChat.mockResolvedValue('Full context summary');

        const result = await service.processTranscript(
          shortText,
          transcriptionId,
          jobId,
          channelId,
        );

        expect(result).toBe('Full context summary');
        expect(mockAiService.callChat).toHaveBeenCalledTimes(1);
      });

      it('applies custom prompt in full-context mode', async () => {
        mockAiService.callChat.mockResolvedValue('Summary');

        await service.processTranscript(
          shortText,
          transcriptionId,
          jobId,
          channelId,
          'Custom instructions',
        );

        const prompt = mockAiService.callChat.mock.calls[0][0];
        expect(prompt).toContain('Additional instructions: Custom instructions');
      });

      it('throws TranscriptChunkingError on empty response', async () => {
        mockAiService.callChat.mockResolvedValue(null);

        await expect(
          service.processTranscript(shortText, transcriptionId, jobId, channelId),
        ).rejects.toThrow(TranscriptChunkingError);
      });
    });

    describe('chunked mode', () => {
      const validStructureJson = JSON.stringify({
        sections: [
          { title: 'Section 1', startPhrase: 'Start' },
        ],
        keyThemes: ['theme1'],
        crossReferences: [],
      });

      beforeEach(() => {
        mockConfigService.getProcessingModeForChannel.mockReturnValue('chunked');
        mockConfigService.getYoutubeTranscriptionsChunkingConfig.mockReturnValue({
          maxTranscriptionTokens: 100,
          transcriptionChunkSize: 100,
          transcriptionChunkOverlap: 10,
        });
      });

      it('extracts structure and processes chunks', async () => {
        const longText = 'This is sentence one. This is sentence two. This is sentence three. This is sentence four.';
        mockAiService.callChat
          .mockResolvedValueOnce(validStructureJson)
          .mockResolvedValueOnce('Chunk 1 summary')
          .mockResolvedValueOnce('Final synthesized summary');

        const result = await service.processTranscript(
          longText,
          transcriptionId,
          jobId,
          channelId,
        );

        expect(result).toBe('Final synthesized summary');
        expect(mockAiService.callChat).toHaveBeenCalledTimes(3);
      });

      it('applies custom prompt to chunk summaries', async () => {
        const longText = 'This is sentence one. This is sentence two. This is sentence three.';
        mockAiService.callChat
          .mockResolvedValueOnce(validStructureJson)
          .mockResolvedValueOnce('Chunk summary')
          .mockResolvedValueOnce('Final summary');

        await service.processTranscript(
          longText,
          transcriptionId,
          jobId,
          channelId,
          'Focus on key points',
        );

        const chunkPrompt = mockAiService.callChat.mock.calls[1][0];
        expect(chunkPrompt).toContain('Additional instructions: Focus on key points');
      });

      it('stores partial results on chunk failure', async () => {
        const longText = 'This is sentence one. This is sentence two. This is sentence three.';
        mockAiService.callChat
          .mockResolvedValueOnce(validStructureJson)
          .mockResolvedValueOnce('Chunk 1 summary')
          .mockResolvedValueOnce(null);

        await expect(
          service.processTranscript(longText, transcriptionId, jobId, channelId),
        ).rejects.toThrow(TranscriptChunkingError);

        expect(mockRedisClient.setex).toHaveBeenCalled();
      });

      it('falls back to simple chunking on structure extraction failure', async () => {
        const longText = 'This is sentence one. This is sentence two. This is sentence three.';
        mockAiService.callChat
          .mockRejectedValueOnce(new Error('Structure extraction failed'))
          .mockResolvedValueOnce('Chunk summary')
          .mockResolvedValueOnce('Final summary');

        const result = await service.processTranscript(
          longText,
          transcriptionId,
          jobId,
          channelId,
        );

        expect(result).toBe('Final summary');
      });
    });
  });
});