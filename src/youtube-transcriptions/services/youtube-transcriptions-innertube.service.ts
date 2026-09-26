import { Injectable } from '@nestjs/common';
import axios, { type AxiosRequestConfig } from 'axios';
import { Innertube } from 'youtubei.js';
import { TranscriptItem } from '../../shared/types/video';
import {
  InnertubeBasicInfoError,
  InnertubeClientCreateError,
  InnertubeNoCaptionTracksError,
  InnertubeNoValidCaptionUrlError,
  InnertubeTimedTextFetchError,
  InnertubeTranscriptFetchError,
  InnertubeTranscriptParseError,
} from '../errors/innertube-errors';
import type {
  TranscriptFetchOptions,
  TranscriptSource,
} from './transcript-fetcher.service';

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
    const config: AxiosRequestConfig = {
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

    const response = await axios.get<string>(captionUrl, config);

    if (response.status !== 200) {
      throw new InnertubeTimedTextFetchError({
        status: response.status,
        url: captionUrl,
        videoId,
      });
    }

    const xml = response.data;

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
const parsePTagFormat = (xml: string): TranscriptItem[] => {
  const items: TranscriptItem[] = [];
  const pTagRegex = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;

  let match = pTagRegex.exec(xml);
  while (match !== null) {
    const [, startMsStr, durationMsStr, rawText] = match;
    if (startMsStr && durationMsStr && rawText) {
      const text = decodeHtmlEntities(rawText.replace(/<[^>]+>/g, '')).trim();
      if (text) {
        items.push({
          text,
          offset: Number.parseInt(startMsStr, 10),
          duration: Number.parseInt(durationMsStr, 10),
        });
      }
    }
    match = pTagRegex.exec(xml);
  }
  return items;
};

/**
 * Parse <text start="sec" dur="sec">text</text> format (alternative format)
 */
const parseTextTagFormat = (xml: string): TranscriptItem[] => {
  const items: TranscriptItem[] = [];
  const textTagRegex =
    /<text\s+start="([\d.]+)"\s+dur="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g;

  let match = textTagRegex.exec(xml);
  while (match !== null) {
    const [, startStr, durStr, rawText] = match;
    if (startStr && durStr && rawText) {
      const text = decodeHtmlEntities(rawText.replace(/<[^>]+>/g, '')).trim();
      if (text) {
        items.push({
          text,
          offset: Math.round(Number.parseFloat(startStr) * 1000),
          duration: Math.round(Number.parseFloat(durStr) * 1000),
        });
      }
    }
    match = textTagRegex.exec(xml);
  }
  return items;
};

/**
 * Parse timedtext XML into transcript items. Supports both the <p> format
 * (Android client) and the <text> format.
 */
export const parseTimedTextXml = (xml: string): TranscriptItem[] => {
  const pItems = parsePTagFormat(xml);
  if (pItems.length > 0) {
    return pItems;
  }
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
 * Picks the English caption track, preferring a manual one over ASR, then any
 * English variant, then whatever track comes first. youtubei.js types these
 * fields as required but copies them from the raw player response unchecked,
 * so the fields stay optional here.
 */
export const pickCaptionTrack = <
  T extends { language_code?: string; kind?: string },
>(
  tracks: T[],
): T | undefined =>
  tracks.find(
    (track) => track.language_code === 'en' && track.kind !== 'asr',
  ) ??
  tracks.find((track) => track.language_code?.startsWith('en')) ??
  tracks[0];

/**
 * Transcript source that asks Innertube's WEB client for caption track URLs,
 * then fetches the timedtext XML directly. Needs no YouTube API key, and is
 * the only source that honors a proxy.
 */
@Injectable()
export class YoutubeTranscriptionsInnertubeService implements TranscriptSource {
  readonly method = 'innertube';

  async fetchTranscript(
    videoId: string,
    { proxyUrl }: TranscriptFetchOptions = {},
  ): Promise<TranscriptItem[]> {
    try {
      const client = await Innertube.create({
        generate_session_locally: true,
        lang: 'en',
        location: 'US',
        retrieve_player: false,
      });

      const info = await client
        .getBasicInfo(videoId)
        .catch((error: unknown) => {
          throw new InnertubeBasicInfoError({ cause: error, videoId });
        });

      const captionTracks = info.captions?.caption_tracks;
      if (!captionTracks || captionTracks.length === 0) {
        throw new InnertubeNoCaptionTracksError({ videoId });
      }

      const track = pickCaptionTrack(captionTracks);
      if (!track?.base_url) {
        throw new InnertubeNoValidCaptionUrlError({
          availableLanguages: captionTracks.map(
            (captionTrack) => captionTrack.language_code ?? 'unknown',
          ),
          videoId,
        });
      }

      const xml = await fetchTimedTextXml(track.base_url, proxyUrl, videoId);
      const items = parseTimedTextXml(xml);

      if (items.length === 0) {
        throw new InnertubeTranscriptParseError({ videoId });
      }

      return items;
    } catch (error) {
      if (error instanceof InnertubeTranscriptFetchError) {
        throw error;
      }
      throw new InnertubeClientCreateError({ cause: error, videoId });
    }
  }
}
