import { YoutubeTranscript } from 'youtube-transcript-plus';
import {
  YoutubeTranscriptionsAlternativeService,
  fetchPlayerWithOriginalTrackFirst,
} from './youtube-transcriptions-alternative.service';

const fetchCaptionLanguages = async (tracklist: object) => {
  jest.spyOn(global, 'fetch').mockResolvedValue(
    Response.json({
      captions: { playerCaptionsTracklistRenderer: tracklist },
    }),
  );

  const response = await fetchPlayerWithOriginalTrackFirst({
    url: 'https://www.youtube.com/youtubei/v1/player?key=key',
  });
  const player = (await response.json()) as {
    captions: {
      playerCaptionsTracklistRenderer: {
        captionTracks: { languageCode: string }[];
      };
    };
  };

  return player.captions.playerCaptionsTracklistRenderer.captionTracks.map(
    ({ languageCode }) => languageCode,
  );
};

describe('fetchPlayerWithOriginalTrackFirst', () => {
  afterEach(() => jest.restoreAllMocks());

  it("moves the default audio track's caption track to the front", async () => {
    const languages = await fetchCaptionLanguages({
      captionTracks: [
        { languageCode: 'ar' },
        { languageCode: 'en' },
        { languageCode: 'pt' },
      ],
      audioTracks: [
        { captionTrackIndices: [0, 1, 2] },
        { captionTrackIndices: [1, 0, 2] },
      ],
      defaultAudioTrackIndex: 1,
    });

    expect(languages).toEqual(['en', 'ar', 'pt']);
  });

  it('keeps the track order when the player lists no audio tracks', async () => {
    const languages = await fetchCaptionLanguages({
      captionTracks: [{ languageCode: 'ar' }, { languageCode: 'en' }],
    });

    expect(languages).toEqual(['ar', 'en']);
  });
});

describe('YoutubeTranscriptionsAlternativeService', () => {
  const service = new YoutubeTranscriptionsAlternativeService();

  afterEach(() => jest.restoreAllMocks());

  it('lets the library take the reordered first track instead of pinning a language', async () => {
    const fetchTranscript = jest.spyOn(YoutubeTranscript, 'fetchTranscript');

    await service.fetchTranscript('BZxHviFY_YY');

    expect(fetchTranscript).toHaveBeenCalledWith('BZxHviFY_YY', {
      playerFetch: fetchPlayerWithOriginalTrackFirst,
    });
  });
});
