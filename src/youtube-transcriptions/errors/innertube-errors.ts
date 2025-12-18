/**
 * Base error class for Innertube transcript fetching errors
 */
export class InnertubeTranscriptFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InnertubeTranscriptFetchError';
  }
}

/**
 * Error when fetching timedtext XML fails
 */
export class InnertubeTimedTextFetchError extends InnertubeTranscriptFetchError {
  constructor(options: { cause?: unknown; url: string; videoId: string; status?: number }) {
    const message = options.status
      ? `Failed to fetch timedtext XML for video ${options.videoId} from ${options.url} (status: ${options.status})`
      : `Failed to fetch timedtext XML for video ${options.videoId} from ${options.url}`;
    super(message);
    this.name = 'InnertubeTimedTextFetchError';
    if (options.cause) {
      this.cause = options.cause;
    }
  }
}

/**
 * Error when creating Innertube client fails
 */
export class InnertubeClientCreateError extends InnertubeTranscriptFetchError {
  constructor(options: { cause?: unknown; videoId: string }) {
    super(`Failed to create Innertube client for video ${options.videoId}`);
    this.name = 'InnertubeClientCreateError';
    if (options.cause) {
      this.cause = options.cause;
    }
  }
}

/**
 * Error when fetching basic info fails
 */
export class InnertubeBasicInfoError extends InnertubeTranscriptFetchError {
  constructor(options: { cause?: unknown; videoId: string }) {
    super(`Failed to fetch basic info for video ${options.videoId}`);
    this.name = 'InnertubeBasicInfoError';
    if (options.cause) {
      this.cause = options.cause;
    }
  }
}

/**
 * Error when no caption tracks are available
 */
export class InnertubeNoCaptionTracksError extends InnertubeTranscriptFetchError {
  constructor(options: { videoId: string }) {
    super(`No caption tracks available for video ${options.videoId}`);
    this.name = 'InnertubeNoCaptionTracksError';
  }
}

/**
 * Error when no valid caption URL is found
 */
export class InnertubeNoValidCaptionUrlError extends InnertubeTranscriptFetchError {
  constructor(options: { videoId: string; availableLanguages: string[] }) {
    super(
      `No valid caption URL found for video ${options.videoId}. Available languages: ${options.availableLanguages.join(', ')}`,
    );
    this.name = 'InnertubeNoValidCaptionUrlError';
  }
}

/**
 * Error when parsing transcript XML fails
 */
export class InnertubeTranscriptParseError extends InnertubeTranscriptFetchError {
  constructor(options: { videoId: string }) {
    super(`Failed to parse transcript XML for video ${options.videoId}`);
    this.name = 'InnertubeTranscriptParseError';
  }
}
