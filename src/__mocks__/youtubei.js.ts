// Mock for youtubei.js

export const ClientType = {
  WEB: 'web',
  WEB_EMBED: 'web_embed',
};

export const Platform = {
  WEB: 'web',
  // YouTubeService.downloadAudioFromVideo assigns Platform.shim.eval.
  shim: {},
};

export const Types = {
  VIDEO: 'video',
};

export class Innertube {
  static create() {
    return Promise.resolve(new Innertube());
  }

  getChannel(_channelId: string) {
    return Promise.resolve({
      getVideos: () => Promise.resolve({ videos: [] }),
    });
  }

  getInfo(_videoId: string) {
    return Promise.resolve({
      getTranscript: () =>
        Promise.resolve({
          transcript: {
            content: {
              body: {
                initial_segments: [],
              },
            },
          },
        }),
    });
  }
}
