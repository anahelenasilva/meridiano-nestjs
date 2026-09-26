import { Logger } from '@nestjs/common';
import { TranscriptItem } from '../../shared/types/video';

export type TranscriptMethod = 'alternative' | 'library' | 'innertube';

export type TranscriptFetchOptions = { proxyUrl?: string };

export interface TranscriptSource {
  readonly method: TranscriptMethod;
  fetchTranscript(
    videoId: string,
    options?: TranscriptFetchOptions,
  ): Promise<TranscriptItem[]>;
}

export type TranscriptFetchFailure = {
  method: TranscriptMethod;
  message: string;
};

export class TranscriptFetchError extends Error {
  constructor(
    videoId: string,
    readonly failures: TranscriptFetchFailure[],
  ) {
    const reasons = failures
      .map(({ method, message }) => `${method}: ${message}`)
      .join('. ');
    super(`Failed to fetch transcript for video ${videoId}. ${reasons}`);
    this.name = 'TranscriptFetchError';
  }
}

/**
 * Fetches a transcript by trying each source in order until one returns a
 * non-empty transcript. The module wires the order; see
 * youtube-transcriptions.module.ts.
 */
export class TranscriptFetcherService {
  private readonly logger = new Logger(TranscriptFetcherService.name);

  constructor(private readonly sources: readonly TranscriptSource[]) {}

  async fetch(videoId: string, options: TranscriptFetchOptions = {}) {
    const failures: TranscriptFetchFailure[] = [];

    for (const source of this.sources) {
      try {
        const transcript = await source.fetchTranscript(videoId, options);

        if (transcript.length === 0) {
          throw new Error('returned an empty transcript');
        }

        this.logger.log(
          `Fetched transcript via ${source.method} (${transcript.length} items) [videoId=${videoId}]`,
        );

        return {
          method: source.method,
          transcript,
          transcriptText: transcript.map((item) => item.text).join(' '),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Transcript source ${source.method} failed [videoId=${videoId}]: ${message}`,
        );
        failures.push({ method: source.method, message });
      }
    }

    throw new TranscriptFetchError(videoId, failures);
  }
}
