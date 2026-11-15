import * as fs from 'fs/promises';
import { Innertube, Platform } from 'youtubei.js/web';
import { ChannelConfig } from '../../shared/types/channel';
import { YouTubeService } from './youtube.service';

jest.mock('fs/promises');

const NOW = new Date(2024, 4, 31, 22, 30);
const ONE_HOUR_AGO = new Date(2024, 4, 31, 21, 30).toISOString();

const channelConfig: ChannelConfig = {
  databaseId: 'db-1',
  channelId: 'UC123',
  channelName: 'Channel',
  channelDescription: 'About the channel',
  maxVideos: 10,
};

const channel = {
  id: 'UC123',
  databaseId: 'db-1',
  name: 'Channel',
  description: 'About the channel',
};

const video = (videoId: string, overrides: object = {}) => ({
  type: 'Video',
  video_id: videoId,
  title: { text: `Title ${videoId}` },
  published: { text: '1 hour ago' },
  description: `About ${videoId}`,
  thumbnails: [{ url: `https://img/${videoId}.jpg` }],
  ...overrides,
});

describe('YouTubeService', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('getChannelVideos', () => {
    const channelReturns = (videos: unknown[]) =>
      jest.spyOn(Innertube, 'create').mockResolvedValue({
        getChannel: jest.fn().mockResolvedValue({
          getVideos: jest.fn().mockResolvedValue({ videos }),
        }),
      } as never);

    it('builds VideoMetadata for each Video node', async () => {
      channelReturns([video('abc')]);

      await expect(
        new YouTubeService().getChannelVideos(channelConfig),
      ).resolves.toEqual([
        {
          channel,
          videoId: 'abc',
          title: 'Title abc',
          url: 'https://www.youtube.com/watch?v=abc',
          publishedAt: ONE_HOUR_AGO,
          description: 'About abc',
          thumbnailUrl: 'https://img/abc.jpg',
        },
      ]);
    });

    it('skips non-Video nodes without counting them toward maxVideos', async () => {
      channelReturns([
        { type: 'ReelItem' },
        video('abc'),
        { type: 'ShortsLockupView' },
        video('def'),
      ]);

      const videos = await new YouTubeService().getChannelVideos({
        ...channelConfig,
        maxVideos: 2,
      });

      expect(videos.map((v) => v.videoId)).toEqual(['abc', 'def']);
    });

    it('stops at maxVideos', async () => {
      channelReturns([video('abc'), video('def'), video('ghi')]);

      const videos = await new YouTubeService().getChannelVideos({
        ...channelConfig,
        maxVideos: 2,
      });

      expect(videos.map((v) => v.videoId)).toEqual(['abc', 'def']);
    });

    it("falls back to 'No title' for a video with no title text", async () => {
      channelReturns([video('abc', { title: {} })]);

      const [first] = await new YouTubeService().getChannelVideos(
        channelConfig,
      );

      expect(first.title).toBe('No title');
    });

    it("gives an undated video publishedAt 'Unknown' and keeps going", async () => {
      channelReturns([video('abc', { published: undefined }), video('def')]);

      const videos = await new YouTubeService().getChannelVideos(channelConfig);

      expect(videos.map((v) => [v.videoId, v.publishedAt])).toEqual([
        ['abc', 'Unknown'],
        ['def', ONE_HOUR_AGO],
      ]);
    });
  });

  describe('getVideoMetadata', () => {
    const basicInfoReturns = (basicInfo: object) =>
      jest.spyOn(Innertube, 'create').mockResolvedValue({
        getInfo: jest.fn().mockResolvedValue({ basic_info: basicInfo }),
      } as never);

    const getVideoMetadata = () =>
      new YouTubeService().getVideoMetadata(
        'abc',
        'UC123',
        'Channel',
        'About the channel',
        'db-1',
      );

    it('builds VideoMetadata from the video basic info', async () => {
      basicInfoReturns({
        title: 'Title abc',
        start_timestamp: new Date(2024, 0, 15, 9, 0),
        short_description: 'About abc',
        thumbnail: [{ url: 'https://img/abc.jpg' }],
      });

      await expect(getVideoMetadata()).resolves.toEqual({
        channel,
        videoId: 'abc',
        title: 'Title abc',
        url: 'https://www.youtube.com/watch?v=abc',
        publishedAt: new Date(2024, 0, 15, 9, 0).toISOString(),
        description: 'About abc',
        thumbnailUrl: 'https://img/abc.jpg',
      });
    });

    it("falls back to 'No title' and now for a video with bare basic info", async () => {
      basicInfoReturns({});

      await expect(getVideoMetadata()).resolves.toMatchObject({
        title: 'No title',
        publishedAt: NOW.toISOString(),
        description: undefined,
        thumbnailUrl: undefined,
      });
    });
  });

  describe('downloadAudioFromVideo', () => {
    const audio = new ReadableStream();
    const playerScript = {
      output:
        'var exportedVars = { nFunction: (n) => "n-" + n, sigFunction: (s) => "sig-" + s };',
      exported: ['nFunction', 'sigFunction'],
    };

    const downloadReturns = (download: jest.Mock) =>
      jest.spyOn(Innertube, 'create').mockResolvedValue({ download } as never);

    it('downloads the audio to downloads/<videoId>.mp3 and returns it', async () => {
      const download = jest.fn().mockResolvedValue(audio);
      downloadReturns(download);

      await expect(
        new YouTubeService().downloadAudioFromVideo('abc'),
      ).resolves.toBe(audio);

      expect(download).toHaveBeenCalledWith('abc', { type: 'audio' });
      expect(fs.writeFile).toHaveBeenCalledWith('downloads/abc.mp3', audio);
    });

    it('installs a shim eval that returns n and sig from the player script', async () => {
      downloadReturns(jest.fn().mockResolvedValue(audio));
      await new YouTubeService().downloadAudioFromVideo('abc');

      expect(
        Platform.shim.eval(playerScript, { n: 'abc', sig: 'xyz' }),
      ).toEqual({ n: 'n-abc', sig: 'sig-xyz' });
    });

    it('leaves sig out of the shim eval result when the env has no sig', async () => {
      downloadReturns(jest.fn().mockResolvedValue(audio));
      await new YouTubeService().downloadAudioFromVideo('abc');

      expect(Platform.shim.eval(playerScript, { n: 'abc' })).toStrictEqual({
        n: 'n-abc',
      });
    });

    it('rethrows when the download fails', async () => {
      const failure = new Error('Video unavailable');
      downloadReturns(jest.fn().mockRejectedValue(failure));

      await expect(
        new YouTubeService().downloadAudioFromVideo('abc'),
      ).rejects.toBe(failure);
    });
  });
});
