import { canonicalVideoUrl } from './canonical-video-url';

describe('canonicalVideoUrl', () => {
  it('builds the watch url stored in youtube_transcriptions.video_url', () => {
    expect(canonicalVideoUrl('abc123')).toBe(
      'https://www.youtube.com/watch?v=abc123',
    );
  });
});
