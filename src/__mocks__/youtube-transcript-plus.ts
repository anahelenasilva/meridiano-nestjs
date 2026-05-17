export class YoutubeTranscript {
   
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
