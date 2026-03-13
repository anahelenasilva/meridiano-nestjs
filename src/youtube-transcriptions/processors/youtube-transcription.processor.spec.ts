import { AudioJobService } from '@libs/audio';
import { ProcessTranscriptionSummaryJobData } from '@libs/queue';
import { mock } from 'jest-mock-extended';
import { Job } from 'bullmq';
import { AiService } from '../../ai/ai.service';
import { ConfigService } from '../../config/config.service';
import { YoutubeTranscriptionsService } from '../services/youtube-transcriptions.service';
import { YoutubeTranscriptionProcessor } from './youtube-transcription.processor';

describe('YoutubeTranscriptionProcessor', () => {
  let processor: YoutubeTranscriptionProcessor;
  const mockYoutubeTranscriptionsService = mock<YoutubeTranscriptionsService>();
  const mockAiService = mock<AiService>();
  const mockConfigService = mock<ConfigService>();
  const mockAudioJobService = mock<AudioJobService>();

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
      { getClient: () => ({}) } as never,
      mockYoutubeTranscriptionsService,
      mockAiService,
      mockConfigService,
      mockAudioJobService,
    );

    mockConfigService.getTranscriptionSummaryPrompt.mockReturnValue(basePrompt);
    mockYoutubeTranscriptionsService.updateTranscriptionSummary.mockResolvedValue();
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
      mockAiService.callDeepseekChat.mockResolvedValue('Generated summary');

      await processor.processTranscriptionSummary(createJob());

      expect(mockAiService.callDeepseekChat).toHaveBeenCalledWith(basePrompt);
      expect(mockAiService.callDeepseekChat).not.toHaveBeenCalledWith(
        expect.stringContaining('Additional instructions:'),
      );
    });

    it('sends base prompt to AI when transcription has custom_prompt null', async () => {
      mockYoutubeTranscriptionsService.getTranscriptionById.mockResolvedValue({
        id: transcriptionId,
        custom_prompt: null,
      } as never);
      mockAiService.callDeepseekChat.mockResolvedValue('Generated summary');

      await processor.processTranscriptionSummary(createJob());

      expect(mockAiService.callDeepseekChat).toHaveBeenCalledWith(basePrompt);
    });

    it('appends custom prompt when transcription has custom_prompt set', async () => {
      mockYoutubeTranscriptionsService.getTranscriptionById.mockResolvedValue({
        id: transcriptionId,
        custom_prompt: 'Focus on actionable takeaways.',
      } as never);
      mockAiService.callDeepseekChat.mockResolvedValue('Generated summary');

      await processor.processTranscriptionSummary(createJob());

      expect(mockAiService.callDeepseekChat).toHaveBeenCalledWith(
        `${basePrompt}\n\nAdditional instructions: Focus on actionable takeaways.`,
      );
    });
  });
});
