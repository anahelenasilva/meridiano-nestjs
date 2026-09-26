import axios from 'axios';
import { Innertube } from 'youtubei.js';
import {
  InnertubeClientCreateError,
  InnertubeNoCaptionTracksError,
  InnertubeTranscriptParseError,
} from '../errors/innertube-errors';
import {
  YoutubeTranscriptionsInnertubeService,
  parseTimedTextXml,
  pickCaptionTrack,
} from './youtube-transcriptions-innertube.service';

describe('parseTimedTextXml', () => {
  it('parses the <p t d> millisecond format, stripping inner tags', () => {
    const xml = `<timedtext><body>
      <p t="0" d="1500"><s>Hello</s> <s>there</s></p>
      <p t="1500" d="2000">General Kenobi</p>
    </body></timedtext>`;

    expect(parseTimedTextXml(xml)).toEqual([
      { text: 'Hello there', offset: 0, duration: 1500 },
      { text: 'General Kenobi', offset: 1500, duration: 2000 },
    ]);
  });

  it('parses the <text start dur> seconds format into milliseconds', () => {
    const xml = `<transcript>
      <text start="0.5" dur="1.25">first</text>
      <text start="1.75" dur="2">second</text>
    </transcript>`;

    expect(parseTimedTextXml(xml)).toEqual([
      { text: 'first', offset: 500, duration: 1250 },
      { text: 'second', offset: 1750, duration: 2000 },
    ]);
  });

  it('decodes HTML entities and drops segments with no text', () => {
    const xml = `<p t="0" d="100">rock &amp; roll &#39;n&#39; &quot;more&quot;</p>
      <p t="100" d="100">   </p>`;

    expect(parseTimedTextXml(xml)).toEqual([
      { text: `rock & roll 'n' "more"`, offset: 0, duration: 100 },
    ]);
  });

  it('returns no segments for xml in neither format', () => {
    expect(parseTimedTextXml('<html>blocked</html>')).toEqual([]);
  });
});

describe('pickCaptionTrack', () => {
  const asrEnglish = { language_code: 'en', kind: 'asr', base_url: 'asr-en' };
  const manualEnglish = { language_code: 'en', base_url: 'manual-en' };
  const britishEnglish = { language_code: 'en-GB', base_url: 'en-gb' };
  const portuguese = { language_code: 'pt', base_url: 'pt' };

  it('prefers a manual English track over an auto-generated one', () => {
    expect(pickCaptionTrack([asrEnglish, manualEnglish])).toBe(manualEnglish);
  });

  it('falls back to any English variant', () => {
    expect(pickCaptionTrack([portuguese, britishEnglish])).toBe(britishEnglish);
  });

  it('falls back to the first track when none is English', () => {
    expect(pickCaptionTrack([portuguese])).toBe(portuguese);
  });
});

describe('YoutubeTranscriptionsInnertubeService', () => {
  const service = new YoutubeTranscriptionsInnertubeService();
  const englishTrack = { language_code: 'en', base_url: 'https://tt/en' };

  const basicInfoReturns = (info: unknown) =>
    jest.spyOn(Innertube, 'create').mockResolvedValue({
      getBasicInfo: jest.fn().mockResolvedValue(info),
    } as never);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('fetches the picked track through the proxy and parses it', async () => {
    basicInfoReturns({ captions: { caption_tracks: [englishTrack] } });
    const get = jest
      .spyOn(axios, 'get')
      .mockResolvedValue({ status: 200, data: '<p t="0" d="500">hi</p>' });

    const items = await service.fetchTranscript('abc123', {
      proxyUrl: 'http://proxy.local:8080',
    });

    expect(items).toEqual([{ text: 'hi', offset: 0, duration: 500 }]);
    expect(get).toHaveBeenCalledWith(
      'https://tt/en',
      expect.objectContaining({
        proxy: { protocol: 'http', host: 'proxy.local', port: 8080 },
      }),
    );
  });

  it('throws InnertubeNoCaptionTracksError when the video has no captions', async () => {
    basicInfoReturns({ captions: { caption_tracks: [] } });

    await expect(service.fetchTranscript('abc123')).rejects.toBeInstanceOf(
      InnertubeNoCaptionTracksError,
    );
  });

  it('throws InnertubeTranscriptParseError when the xml has no segments', async () => {
    basicInfoReturns({ captions: { caption_tracks: [englishTrack] } });
    jest
      .spyOn(axios, 'get')
      .mockResolvedValue({ status: 200, data: '<html>blocked</html>' });

    await expect(service.fetchTranscript('abc123')).rejects.toBeInstanceOf(
      InnertubeTranscriptParseError,
    );
  });

  it('wraps an unexpected client failure in InnertubeClientCreateError', async () => {
    jest.spyOn(Innertube, 'create').mockRejectedValue(new Error('boom'));

    await expect(service.fetchTranscript('abc123')).rejects.toBeInstanceOf(
      InnertubeClientCreateError,
    );
  });
});
