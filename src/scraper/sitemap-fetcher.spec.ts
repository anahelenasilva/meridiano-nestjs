import axios from 'axios';
import { fetchSitemapEntries, parseSitemapXml } from './sitemap-fetcher';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://claude.com/blog/first-post</loc>
    <lastmod>2026-08-20T18:52:27.790Z</lastmod>
  </url>
  <url>
    <loc>https://claude.com/blog/second-post</loc>
    <lastmod>2026-08-01T10:00:00.000Z</lastmod>
  </url>
  <url>
    <loc>https://claude.com/pricing</loc>
    <lastmod>2026-08-19T00:00:00.000Z</lastmod>
  </url>
  <url>
    <loc>https://claude.com/blog/no-date-post</loc>
  </url>
  <url>
    <loc>https://claude.com/blog/bad-date-post</loc>
    <lastmod>not-a-date</lastmod>
  </url>
</urlset>`;

describe('parseSitemapXml', () => {
  it('keeps only locs under the prefix', () => {
    const entries = parseSitemapXml(SITEMAP, 'https://claude.com/blog/');
    expect(entries.map((e) => e.url)).toEqual([
      'https://claude.com/blog/first-post',
      'https://claude.com/blog/second-post',
      'https://claude.com/blog/no-date-post',
      'https://claude.com/blog/bad-date-post',
    ]);
  });

  it('parses lastmod into a Date', () => {
    const [first] = parseSitemapXml(SITEMAP, 'https://claude.com/blog/');
    expect(first.lastmod).toEqual(new Date('2026-08-20T18:52:27.790Z'));
  });

  it('returns null lastmod when the entry has none', () => {
    const entries = parseSitemapXml(SITEMAP, 'https://claude.com/blog/');
    const noDate = entries.find((e) => e.url.endsWith('no-date-post'));
    expect(noDate?.lastmod).toBeNull();
  });

  it('returns null lastmod when the entry has an unparseable date', () => {
    const entries = parseSitemapXml(SITEMAP, 'https://claude.com/blog/');
    const badDate = entries.find((e) => e.url.endsWith('bad-date-post'));
    expect(badDate?.lastmod).toBeNull();
  });

  it('returns an empty array when nothing matches the prefix', () => {
    expect(parseSitemapXml(SITEMAP, 'https://example.com/blog/')).toEqual([]);
  });
});

describe('fetchSitemapEntries', () => {
  afterEach(() => jest.clearAllMocks());

  it('fetches the sitemap and returns parsed entries', async () => {
    mockedAxios.get.mockResolvedValue({ data: SITEMAP });

    const entries = await fetchSitemapEntries(
      'https://claude.com/sitemap.xml',
      'https://claude.com/blog/',
    );

    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://claude.com/sitemap.xml',
      expect.objectContaining({ responseType: 'text' }),
    );
    expect(entries).toHaveLength(4);
  });
});
