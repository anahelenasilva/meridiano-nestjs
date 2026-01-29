export class YoutubeTranscript {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static fetchTranscript(_videoId: string) {
    return [
      {
        text: 'Mock transcript text',
        duration: 5000,
        offset: 0,
      },
    ];
  }
}
