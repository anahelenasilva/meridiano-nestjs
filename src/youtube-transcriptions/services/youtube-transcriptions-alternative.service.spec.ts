import { YoutubeTranscript } from 'youtube-transcript-plus';
import { YoutubeTranscriptionsAlternativeService } from './youtube-transcriptions-alternative.service';

describe('YoutubeTranscriptionsAlternativeService', () => {
  const service = new YoutubeTranscriptionsAlternativeService();

  afterEach(() => jest.restoreAllMocks());

  it('requests the English caption track', async () => {
    const fetchTranscript = jest
      .spyOn(YoutubeTranscript, 'fetchTranscript')
      .mockResolvedValue([
        { text: 'So, hello folks.', duration: 1000, offset: 0, lang: 'en' },
      ]);

    await service.fetchTranscript('MN9dGgmLyso');

    expect(fetchTranscript).toHaveBeenCalledWith('MN9dGgmLyso', {
      lang: 'en',
    });
  });
});
