// Mock for youtubei.js
/* eslint-disable @typescript-eslint/no-unused-vars */
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
