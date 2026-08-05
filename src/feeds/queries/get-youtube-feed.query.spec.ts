import { mock } from 'jest-mock-extended';
import { YoutubeTranscriptionsService } from '../../youtube-transcriptions/services/youtube-transcriptions.service';
import { YoutubeTranscription } from '../../youtube-transcriptions/entities/youtube-transcription.entity';
import { FEED_DEFAULT_ITEM_LIMIT } from '../helpers/parse-feed-query';
import { GetYoutubeFeedQuery } from './get-youtube-feed.query';

describe('GetYoutubeFeedQuery', () => {
  const mockYoutubeTranscriptionsService = mock<YoutubeTranscriptionsService>();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function buildQuery() {
    return new GetYoutubeFeedQuery(mockYoutubeTranscriptionsService);
  }

  function buildTranscription(
    overrides: Partial<YoutubeTranscription> = {},
  ): YoutubeTranscription {
    return {
      id: 'transcription-1',
      channelId: 'channel-1',
      channelName: 'Channel One',
      videoTitle: 'Video One',
      postedAt: new Date('2026-07-25T12:00:00.000Z'),
      videoUrl: 'https://www.youtube.com/watch?v=abc123',
      processedAt: new Date('2026-07-26T12:00:00.000Z'),
      transcriptionText: 'full transcript text',
      transcriptionSummary: 'short summary',
      ...overrides,
    };
  }

  it('requests the latest transcriptions ordered by processed date descending, bounded by the default limit', async () => {
    mockYoutubeTranscriptionsService.getTranscriptionsPaginated.mockResolvedValue(
      [],
    );

    const query = buildQuery();
    await query.execute('https://api.example.com/feeds/youtube.xml');

    expect(
      mockYoutubeTranscriptionsService.getTranscriptionsPaginated,
    ).toHaveBeenCalledWith({
      page: 1,
      perPage: FEED_DEFAULT_ITEM_LIMIT,
      sort_by: 'processed_at',
      direction: 'desc',
      channel_id: undefined,
    });
  });

  it('requests transcriptions bounded by the given limit', async () => {
    mockYoutubeTranscriptionsService.getTranscriptionsPaginated.mockResolvedValue(
      [],
    );

    const query = buildQuery();
    await query.execute('https://api.example.com/feeds/youtube.xml', {
      limit: 5,
    });

    expect(
      mockYoutubeTranscriptionsService.getTranscriptionsPaginated,
    ).toHaveBeenCalledWith(expect.objectContaining({ perPage: 5 }));
  });

  it('filters by channel id when given', async () => {
    mockYoutubeTranscriptionsService.getTranscriptionsPaginated.mockResolvedValue(
      [],
    );

    const query = buildQuery();
    await query.execute('https://api.example.com/feeds/youtube.xml', {
      channelId: 'channel-1',
    });

    expect(
      mockYoutubeTranscriptionsService.getTranscriptionsPaginated,
    ).toHaveBeenCalledWith(expect.objectContaining({ channel_id: 'channel-1' }));
  });

  it('renders valid RSS XML with the given channel link', async () => {
    mockYoutubeTranscriptionsService.getTranscriptionsPaginated.mockResolvedValue(
      [],
    );

    const query = buildQuery();
    const xml = await query.execute(
      'https://api.example.com/feeds/youtube.xml',
    );

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain(
      '<link>https://api.example.com/feeds/youtube.xml</link>',
    );
  });

  it('maps each transcription to a feed item with a stable GUID, title, video link, and pubDate', async () => {
    const transcription = buildTranscription();
    mockYoutubeTranscriptionsService.getTranscriptionsPaginated.mockResolvedValue(
      [transcription],
    );

    const query = buildQuery();
    const xml = await query.execute(
      'https://api.example.com/feeds/youtube.xml',
    );

    expect(xml).toContain(
      `<guid isPermaLink="false">${transcription.id}</guid>`,
    );
    expect(xml).toContain(`<title>${transcription.videoTitle}</title>`);
    expect(xml).toContain(`<link>${transcription.videoUrl}</link>`);
    expect(xml).toContain(
      `<pubDate>${transcription.postedAt!.toUTCString()}</pubDate>`,
    );
  });

  it('falls back to processedAt for pubDate when postedAt is missing', async () => {
    const transcription = buildTranscription({ postedAt: undefined });
    mockYoutubeTranscriptionsService.getTranscriptionsPaginated.mockResolvedValue(
      [transcription],
    );

    const query = buildQuery();
    const xml = await query.execute(
      'https://api.example.com/feeds/youtube.xml',
    );

    expect(xml).toContain(
      `<pubDate>${transcription.processedAt.toUTCString()}</pubDate>`,
    );
  });

  it('uses the transcription summary as the item description', async () => {
    const transcription = buildTranscription({
      transcriptionSummary: 'short summary',
    });
    mockYoutubeTranscriptionsService.getTranscriptionsPaginated.mockResolvedValue(
      [transcription],
    );

    const query = buildQuery();
    const xml = await query.execute(
      'https://api.example.com/feeds/youtube.xml',
    );

    expect(xml).toContain('<description>short summary</description>');
  });

  it('omits the description when the transcription has no summary', async () => {
    const transcription = buildTranscription({
      transcriptionSummary: undefined,
    });
    mockYoutubeTranscriptionsService.getTranscriptionsPaginated.mockResolvedValue(
      [transcription],
    );

    const query = buildQuery();
    const xml = await query.execute(
      'https://api.example.com/feeds/youtube.xml',
    );

    const itemBlock = xml.slice(xml.indexOf('<item>'), xml.indexOf('</item>'));
    expect(itemBlock).toContain('<title>Video One</title>');
    expect(itemBlock).not.toContain('<description>');
  });

  it('escapes XML-unsafe characters so one malformed transcription cannot break the feed', async () => {
    const transcription = buildTranscription({
      videoTitle: 'Breaking: <script>alert(1)</script> & more',
    });
    mockYoutubeTranscriptionsService.getTranscriptionsPaginated.mockResolvedValue(
      [transcription],
    );

    const query = buildQuery();
    const xml = await query.execute(
      'https://api.example.com/feeds/youtube.xml',
    );

    expect(xml).not.toContain('<script>');
    expect(xml).toContain(
      '<title>Breaking: &lt;script&gt;alert(1)&lt;/script&gt; &amp; more</title>',
    );
  });

  it('returns an empty item list when there are no transcriptions', async () => {
    mockYoutubeTranscriptionsService.getTranscriptionsPaginated.mockResolvedValue(
      [],
    );

    const query = buildQuery();
    const xml = await query.execute(
      'https://api.example.com/feeds/youtube.xml',
    );

    expect(xml).not.toContain('<item>');
  });

  it('propagates errors from the transcriptions service', async () => {
    mockYoutubeTranscriptionsService.getTranscriptionsPaginated.mockRejectedValue(
      new Error('db unavailable'),
    );

    const query = buildQuery();

    await expect(
      query.execute('https://api.example.com/feeds/youtube.xml'),
    ).rejects.toThrow('db unavailable');
  });
});
