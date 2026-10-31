import { createWorker } from '@libs/queue/create-worker';
import { Logger } from '@nestjs/common';
import { AudioJobService } from '@libs/audio';
import { ProcessTranscriptionSummaryJobData } from '@libs/queue';
import { mock } from 'jest-mock-extended';
import { Job, Queue } from 'bullmq';
import { AiService } from '../../ai/ai.service';
import { ConfigService } from '../../config/config.service';
import { TranscriptChunkingError } from '../errors/transcript-chunking.errors';
import { TranscriptChunkingService } from '../services/transcript-chunking.service';
import { YoutubeTranscriptionsService } from '../services/youtube-transcriptions.service';
import { YoutubeTranscriptionProcessor } from './youtube-transcription.processor';

jest.mock('@libs/queue/create-worker');

describe('YoutubeTranscriptionProcessor', () => {
  const mockQueue = mock<Queue>();
  let processor: YoutubeTranscriptionProcessor;
  const mockYoutubeTranscriptionsService = mock<YoutubeTranscriptionsService>();
  const mockAiService = mock<AiService>();
  const mockConfigService = mock<ConfigService>();
  const mockAudioJobService = mock<AudioJobService>();
  const mockTranscriptChunkingService = mock<TranscriptChunkingService>();

  const basePrompt = 'Summarize this transcription.';
  const transcriptionId = 'transcription-uuid-123';
  const transcriptText = 'Video transcript content...';
  const videoTitle = 'Test Video';

  const createJob = (
    overrides?: Partial<ProcessTranscriptionSummaryJobData>,
  ): Job<ProcessTranscriptionSummaryJobData> =>
    ({
      data: {
        transcriptionId,
        transcriptText,
        videoTitle,
        ...overrides,
      },
      id: 'job-1',
    }) as Job<ProcessTranscriptionSummaryJobData>;

  beforeEach(() => {
    processor = new YoutubeTranscriptionProcessor(
      mockQueue,
      mockYoutubeTranscriptionsService,
      mockAiService,
      mockConfigService,
      mockAudioJobService,
      mockTranscriptChunkingService,
    );

    mockConfigService.getTranscriptionSummaryPrompt.mockReturnValue(basePrompt);
    mockYoutubeTranscriptionsService.updateTranscriptionSummary.mockResolvedValue();
    mockTranscriptChunkingService.needsChunking.mockReturnValue(false);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processTranscriptionSummary - backward compatibility (custom prompt)', () => {
    it('sends base prompt to AI when transcription has no custom_prompt', async () => {
      mockYoutubeTranscriptionsService.getTranscriptionById.mockResolvedValue({
        id: transcriptionId,
        custom_prompt: undefined,
      } as never);
      mockAiService.callChatOrThrow.mockResolvedValue('Generated summary');

      await processor.processTranscriptionSummary(createJob());

      expect(mockAiService.callChatOrThrow).toHaveBeenCalledWith(basePrompt);
      expect(mockAiService.callChatOrThrow).not.toHaveBeenCalledWith(
        expect.stringContaining('Additional instructions:'),
      );
    });

    it('sends base prompt to AI when transcription has custom_prompt null', async () => {
      mockYoutubeTranscriptionsService.getTranscriptionById.mockResolvedValue({
        id: transcriptionId,
        custom_prompt: null,
      } as never);
      mockAiService.callChatOrThrow.mockResolvedValue('Generated summary');

      await processor.processTranscriptionSummary(createJob());

      expect(mockAiService.callChatOrThrow).toHaveBeenCalledWith(basePrompt);
    });

    it('appends custom prompt when transcription has custom_prompt set', async () => {
      mockYoutubeTranscriptionsService.getTranscriptionById.mockResolvedValue({
        id: transcriptionId,
        custom_prompt: 'Focus on actionable takeaways.',
      } as never);
      mockAiService.callChatOrThrow.mockResolvedValue('Generated summary');

      await processor.processTranscriptionSummary(createJob());

      expect(mockAiService.callChatOrThrow).toHaveBeenCalledWith(
        `${basePrompt}\n\nAdditional instructions: Focus on actionable takeaways.`,
      );
    });
  });

  describe('processTranscriptionSummary - provider failure', () => {
    beforeEach(() => {
      mockYoutubeTranscriptionsService.getTranscriptionById.mockResolvedValue({
        id: transcriptionId,
        custom_prompt: null,
      } as never);
    });

    it('fails the job when the provider errors on the single-pass path', async () => {
      mockAiService.callChatOrThrow.mockRejectedValue(
        new Error('401 Incorrect API key provided'),
      );

      await expect(
        processor.processTranscriptionSummary(createJob()),
      ).rejects.toThrow('401 Incorrect API key provided');

      expect(
        mockYoutubeTranscriptionsService.updateTranscriptionSummary,
      ).not.toHaveBeenCalled();
    });

    it('fails the job when the provider errors on the chunked path', async () => {
      mockTranscriptChunkingService.needsChunking.mockReturnValue(true);
      mockTranscriptChunkingService.processTranscript.mockRejectedValue(
        new TranscriptChunkingError(
          'Chunk 1 processing failed',
          transcriptionId,
          'job-1',
        ),
      );

      await expect(
        processor.processTranscriptionSummary(createJob()),
      ).rejects.toThrow('Chunk 1 processing failed');

      expect(
        mockYoutubeTranscriptionsService.updateTranscriptionSummary,
      ).not.toHaveBeenCalled();
    });
  });

  describe('onModuleInit', () => {
    it('starts a worker on the YouTube Transcription summary queue', () => {
      processor.onModuleInit();

      expect(createWorker).toHaveBeenCalledWith(mockQueue, expect.any(Function), {
        logger: expect.any(Logger),
      });
    });
  });
});
