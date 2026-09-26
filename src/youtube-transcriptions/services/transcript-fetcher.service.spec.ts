import { TranscriptItem } from '../../shared/types/video';
import {
  TranscriptFetchError,
  TranscriptFetcherService,
  TranscriptMethod,
  TranscriptSource,
} from './transcript-fetcher.service';

const items: TranscriptItem[] = [
  { text: 'Hello', duration: 1000, offset: 0 },
  { text: 'World', duration: 1000, offset: 1000 },
];

const succeeding = (method: TranscriptMethod): TranscriptSource => ({
  method,
  fetchTranscript: jest.fn().mockResolvedValue(items),
});

const failing = (method: TranscriptMethod, message: string) => ({
  method,
  fetchTranscript: jest.fn().mockRejectedValue(new Error(message)),
});

describe('TranscriptFetcherService', () => {
  it('returns the first source that produces a transcript and skips the rest', async () => {
    const first = succeeding('alternative');
    const second = succeeding('library');
    const fetcher = new TranscriptFetcherService([first, second]);

    const result = await fetcher.fetch('abc123');

    expect(result).toEqual({
      method: 'alternative',
      transcript: items,
      transcriptText: 'Hello World',
    });
    expect(second.fetchTranscript).not.toHaveBeenCalled();
  });

  it('falls back to the second source when the first throws', async () => {
    const fetcher = new TranscriptFetcherService([
      failing('alternative', 'blocked'),
      succeeding('library'),
      succeeding('innertube'),
    ]);

    const result = await fetcher.fetch('abc123');

    expect(result.method).toBe('library');
  });

  it('falls back to the third source and passes the proxy through', async () => {
    const innertube = succeeding('innertube');
    const fetcher = new TranscriptFetcherService([
      failing('alternative', 'blocked'),
      failing('library', 'no captions'),
      innertube,
    ]);

    const result = await fetcher.fetch('abc123', {
      proxyUrl: 'http://proxy:8080',
    });

    expect(result.method).toBe('innertube');
    expect(innertube.fetchTranscript).toHaveBeenCalledWith('abc123', {
      proxyUrl: 'http://proxy:8080',
    });
  });

  it('treats an empty transcript as a failure and moves on', async () => {
    const fetcher = new TranscriptFetcherService([
      {
        method: 'alternative',
        fetchTranscript: jest.fn().mockResolvedValue([]),
      },
      succeeding('library'),
    ]);

    const result = await fetcher.fetch('abc123');

    expect(result.method).toBe('library');
  });

  it('throws one error naming every source failure when all fail', async () => {
    const fetcher = new TranscriptFetcherService([
      failing('alternative', 'blocked'),
      { method: 'library', fetchTranscript: jest.fn().mockResolvedValue([]) },
      failing('innertube', 'no caption tracks'),
    ]);

    const error = await fetcher.fetch('abc123').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(TranscriptFetchError);
    expect((error as TranscriptFetchError).failures).toEqual([
      { method: 'alternative', message: 'blocked' },
      { method: 'library', message: 'returned an empty transcript' },
      { method: 'innertube', message: 'no caption tracks' },
    ]);
    expect((error as Error).message).toBe(
      'Failed to fetch transcript for video abc123. alternative: blocked. library: returned an empty transcript. innertube: no caption tracks',
    );
  });
});
