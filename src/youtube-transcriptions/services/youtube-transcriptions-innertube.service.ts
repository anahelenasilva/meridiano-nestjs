import axios from 'axios';
import { Innertube } from 'youtubei.js';
import {
  InnertubeBasicInfoError,
  InnertubeClientCreateError,
  InnertubeNoCaptionTracksError,
  InnertubeNoValidCaptionUrlError,
  InnertubeTimedTextFetchError,
  InnertubeTranscriptParseError,
} from '../errors/innertube-errors';

/**
 * Parsed transcript segment from timedtext XML
 */
type TranscriptSegment = {
  durationMs: number;
  startMs: number;
  text: string;
};

/**
 * YouTube transcript segment format (matching youtubei.js structure)
 */
type YouTubeTranscriptSegment = {
  end_ms: string;
  snippet: {
    text: string;
  };
  start_ms: string;
  start_time_text: {
    text: string;
  };
};

/**
 * Fetch transcript XML from timedtext API
 *
 * @param captionUrl - The timedtext URL from caption tracks
 * @param proxyUrl - The proxy URL to use for the request (optional)
 * @param videoId - The video ID for error context
 */
const fetchTimedTextXml = async (
  captionUrl: string,
  proxyUrl: string | undefined,
  videoId: string,
): Promise<string> => {
  try {
    const config: any = {
      headers: {
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 10000,
    };

    if (proxyUrl) {
      const proxyMatch = proxyUrl.match(/^(https?):\/\/([^:]+):(\d+)$/);
      if (proxyMatch) {
        const [, protocol, host, port] = proxyMatch;
        config.proxy = {
          host,
          port: parseInt(port, 10),
          protocol,
        };
      }
    }

    const response = await axios.get(captionUrl, config);

    if (response.status !== 200) {
      throw new InnertubeTimedTextFetchError({
        status: response.status,
        url: captionUrl,
        videoId,
      });
    }

    const xml = response.data as string;

    if (!xml || xml.length === 0) {
      throw new InnertubeTimedTextFetchError({
        url: captionUrl,
        videoId,
      });
    }

    return xml;
  } catch (error) {
    if (error instanceof InnertubeTimedTextFetchError) {
      throw error;
    }
    throw new InnertubeTimedTextFetchError({
      cause: error,
      url: captionUrl,
      videoId,
    });
  }
};

/**
 * Parse <p t="ms" d="ms">text</p> format (Android client)
 */
const parsePTagFormat = (xml: string): Array<TranscriptSegment> => {
  const segments: Array<TranscriptSegment> = [];
  const pTagRegex = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;

  let match = pTagRegex.exec(xml);
  while (match !== null) {
    const [, startMsStr, durationMsStr, rawText] = match;
    if (startMsStr && durationMsStr && rawText) {
      const text = decodeHtmlEntities(rawText.replace(/<[^>]+>/g, '')).trim();
      if (text) {
        segments.push({
          durationMs: Number.parseInt(durationMsStr, 10),
          startMs: Number.parseInt(startMsStr, 10),
          text,
        });
      }
    }
    match = pTagRegex.exec(xml);
  }
  return segments;
};

/**
 * Parse <text start="sec" dur="sec">text</text> format (alternative format)
 */
const parseTextTagFormat = (xml: string): Array<TranscriptSegment> => {
  const segments: Array<TranscriptSegment> = [];
  const textTagRegex =
    /<text\s+start="([\d.]+)"\s+dur="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g;

  let match = textTagRegex.exec(xml);
  while (match !== null) {
    const [, startStr, durStr, rawText] = match;
    if (startStr && durStr && rawText) {
      const text = decodeHtmlEntities(rawText.replace(/<[^>]+>/g, '')).trim();
      if (text) {
        segments.push({
          durationMs: Math.round(Number.parseFloat(durStr) * 1000),
          startMs: Math.round(Number.parseFloat(startStr) * 1000),
          text,
        });
      }
    }
    match = textTagRegex.exec(xml);
  }
  return segments;
};

/**
 * Parse timedtext XML into transcript segments
 * Supports both <p> format (Android) and <text> format (alternative)
 */
const parseTimedTextXml = (xml: string): Array<TranscriptSegment> => {
  // Try <p> tag format first (Android client format)
  const pSegments = parsePTagFormat(xml);
  if (pSegments.length > 0) {
    return pSegments;
  }
  // Fall back to <text> tag format
  return parseTextTagFormat(xml);
};

/**
 * Decode common HTML entities in transcript text
 */
const decodeHtmlEntities = (text: string): string =>
  text
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, num) =>
      globalThis.String.fromCharCode(Number.parseInt(num, 10)),
    );

/**
 * Convert parsed transcript segments to youtubei.js TranscriptSegmentList format
 */
const convertToYouTubeSegments = (
  segments: Array<TranscriptSegment>,
): Array<YouTubeTranscriptSegment> => {
  return segments.map((segment) => ({
    end_ms: globalThis.String(segment.startMs + segment.durationMs),
    snippet: {
      text: segment.text,
    },
    start_ms: globalThis.String(segment.startMs),
    start_time_text: {
      text: formatTimestamp(segment.startMs),
    },
  }));
};

/**
 * Format milliseconds as a timestamp string (e.g., "1:23" or "1:23:45")
 */
const formatTimestamp = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * Fetch transcript using Innertube's getBasicInfo to get caption URLs
 * This approach doesn't require a YouTube API key - it uses the standard
 * Innertube WEB client to get caption track URLs, then fetches timedtext directly.
 *
 * @param videoId - Raw YouTube video ID (without video_ prefix)
 * @param proxyUrl - The proxy URL to use for requests (optional)
 */
export const fetchTranscriptViaInnertube = async (
  videoId: string,
  proxyUrl?: string,
): Promise<Array<YouTubeTranscriptSegment>> => {
  try {
    // 1. Create Innertube client
    const client = await Innertube.create({
      generate_session_locally: true,
      lang: 'en',
      location: 'US',
      retrieve_player: false,
    });

    // 2. Get basic info (includes caption tracks)
    let info;
    try {
      info = await client.getBasicInfo(videoId);
    } catch (error) {
      throw new InnertubeBasicInfoError({ cause: error, videoId });
    }

    // 3. Check for caption tracks
    const captionTracks = info.captions?.caption_tracks;
    if (!captionTracks || captionTracks.length === 0) {
      throw new InnertubeNoCaptionTracksError({ videoId });
    }

    // 4. Find English caption track (prefer non-ASR if available)
    const englishTrack: any =
      captionTracks.find(
        (t: any) => t.language_code === 'en' && t.kind !== 'asr',
      ) ||
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      captionTracks.find((t: any) => t.language_code?.startsWith('en')) ||
      captionTracks[0];

    if (!englishTrack?.base_url) {
      throw new InnertubeNoValidCaptionUrlError({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        availableLanguages: captionTracks.map(
          (t: any) => t.language_code ?? 'unknown',
        ) as string[],
        videoId,
      });
    }

    // 5. Fetch timedtext XML
    const xml = await fetchTimedTextXml(
      englishTrack.base_url,
      proxyUrl,
      videoId,
    );

    // 6. Parse XML to segments
    const segments = parseTimedTextXml(xml);

    if (segments.length === 0) {
      throw new InnertubeTranscriptParseError({ videoId });
    }

    // 7. Convert to YouTube.js format
    return convertToYouTubeSegments(segments);
  } catch (error) {
    if (error instanceof InnertubeClientCreateError) {
      throw error;
    }
    if (
      error instanceof InnertubeBasicInfoError ||
      error instanceof InnertubeNoCaptionTracksError ||
      error instanceof InnertubeNoValidCaptionUrlError ||
      error instanceof InnertubeTimedTextFetchError ||
      error instanceof InnertubeTranscriptParseError
    ) {
      throw error;
    }
    throw new InnertubeClientCreateError({ cause: error, videoId });
  }
};
