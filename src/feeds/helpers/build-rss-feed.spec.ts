import { buildRssFeed, escapeXml } from './build-rss-feed';

describe('buildRssFeed', () => {
  it('renders a valid RSS 2.0 document with channel metadata', () => {
    const xml = buildRssFeed({
      title: 'Meridiano Articles',
      link: 'https://api.example.com/feeds/articles.xml',
      description: 'Latest Articles curated by Meridiano',
      items: [],
    });

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<rss version="2.0">');
    expect(xml).toContain('<title>Meridiano Articles</title>');
    expect(xml).toContain(
      '<link>https://api.example.com/feeds/articles.xml</link>',
    );
    expect(xml).toContain(
      '<description>Latest Articles curated by Meridiano</description>',
    );
    expect(xml).toContain('</rss>');
  });

  it('defaults the channel language to en-us when not provided', () => {
    const xml = buildRssFeed({
      title: 'Feed',
      link: 'https://example.com',
      description: 'Desc',
      items: [],
    });

    expect(xml).toContain('<language>en-us</language>');
  });

  it('renders one <item> per feed item with guid, title, link, and pubDate', () => {
    const pubDate = new Date('2026-07-25T12:00:00.000Z');
    const xml = buildRssFeed({
      title: 'Feed',
      link: 'https://example.com',
      description: 'Desc',
      items: [
        {
          guid: 'article-1',
          title: 'Article One',
          link: 'https://source.example.com/article-1',
          pubDate,
        },
      ],
    });

    expect(xml).toContain('<guid isPermaLink="false">article-1</guid>');
    expect(xml).toContain('<title>Article One</title>');
    expect(xml).toContain(
      '<link>https://source.example.com/article-1</link>',
    );
    expect(xml).toContain(`<pubDate>${pubDate.toUTCString()}</pubDate>`);
  });

  it('includes a description element when the item has a description', () => {
    const xml = buildRssFeed({
      title: 'Feed',
      link: 'https://example.com',
      description: 'Desc',
      items: [
        {
          guid: 'article-1',
          title: 'Article One',
          link: 'https://source.example.com/article-1',
          pubDate: new Date('2026-07-25T12:00:00.000Z'),
          description: 'Body excerpt',
        },
      ],
    });

    expect(xml).toContain('<description>Body excerpt</description>');
  });

  it('omits the description element when the item has no description', () => {
    const xml = buildRssFeed({
      title: 'Feed',
      link: 'https://example.com',
      description: 'Desc',
      items: [
        {
          guid: 'article-1',
          title: 'Article One',
          link: 'https://source.example.com/article-1',
          pubDate: new Date('2026-07-25T12:00:00.000Z'),
        },
      ],
    });

    const itemBlock = xml.slice(xml.indexOf('<item>'), xml.indexOf('</item>'));
    expect(itemBlock).not.toContain('<description>');
  });

  it('renders multiple items in the given order', () => {
    const xml = buildRssFeed({
      title: 'Feed',
      link: 'https://example.com',
      description: 'Desc',
      items: [
        {
          guid: 'first',
          title: 'First',
          link: 'https://example.com/first',
          pubDate: new Date('2026-07-25T12:00:00.000Z'),
        },
        {
          guid: 'second',
          title: 'Second',
          link: 'https://example.com/second',
          pubDate: new Date('2026-07-24T12:00:00.000Z'),
        },
      ],
    });

    expect(xml.indexOf('>first<')).toBeLessThan(xml.indexOf('>second<'));
  });
});

describe('escapeXml', () => {
  it('escapes &, <, >, ", and \' so a single malformed character cannot break the document', () => {
    expect(escapeXml(`Tom & Jerry <b>"quoted"</b> it's fine`)).toBe(
      'Tom &amp; Jerry &lt;b&gt;&quot;quoted&quot;&lt;/b&gt; it&apos;s fine',
    );
  });

  it('leaves plain text untouched', () => {
    expect(escapeXml('Plain title')).toBe('Plain title');
  });
});
