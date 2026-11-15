import { Innertube } from 'youtubei.js';
import { TranscriptService } from './transcript.service';

const segment = (startMs: string, endMs: string, text?: string) => ({
  type: 'TranscriptSegment',
  start_ms: startMs,
  end_ms: endMs,
  snippet: { text },
});

describe('TranscriptService', () => {
  const transcriptReturns = (transcript: unknown) =>
    jest.spyOn(Innertube, 'create').mockResolvedValue({
      getInfo: jest.fn().mockResolvedValue({
        getTranscript: jest.fn().mockResolvedValue(transcript),
      }),
    } as never);

  const bodyWith = (initialSegments: unknown[]) => ({
    transcript: { content: { body: { initial_segments: initialSegments } } },
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('maps segments to items with numeric offset and duration', async () => {
    transcriptReturns(
      bodyWith([
        segment('0', '1500', 'Hello there'),
        segment('1500', '3500', 'General Kenobi'),
      ]),
    );

    await expect(
      new TranscriptService().fetchTranscript('vid1'),
    ).resolves.toEqual([
      { text: 'Hello there', offset: 0, duration: 1500 },
      { text: 'General Kenobi', offset: 1500, duration: 2000 },
    ]);
  });

  it('drops chapter headings', async () => {
    transcriptReturns(
      bodyWith([
        { ...segment('0', '5000', 'Intro'), type: 'TranscriptSectionHeader' },
        segment('0', '1500', 'Hello there'),
      ]),
    );

    await expect(
      new TranscriptService().fetchTranscript('vid1'),
    ).resolves.toEqual([{ text: 'Hello there', offset: 0, duration: 1500 }]);
  });

  it('turns a segment with no snippet text into an item with empty text', async () => {
    transcriptReturns(bodyWith([segment('0', '800')]));

    await expect(
      new TranscriptService().fetchTranscript('vid1'),
    ).resolves.toEqual([{ text: '', offset: 0, duration: 800 }]);
  });

  it('returns an empty list when the transcript has no body', async () => {
    transcriptReturns({ transcript: { content: {} } });

    await expect(
      new TranscriptService().fetchTranscript('vid1'),
    ).resolves.toEqual([]);
  });

  it('wraps a youtubei.js error with the video id', async () => {
    jest.spyOn(Innertube, 'create').mockResolvedValue({
      getInfo: jest.fn().mockRejectedValue(new Error('Video unavailable')),
    } as never);

    await expect(
      new TranscriptService().fetchTranscript('vid1'),
    ).rejects.toThrow(
      'Failed to fetch transcript for video vid1: Video unavailable',
    );
  });
});
