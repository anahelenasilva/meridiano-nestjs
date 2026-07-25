export interface RssFeedItem {
  guid: string;
  title: string;
  link: string;
  pubDate: Date;
  description?: string | null;
}

export interface RssFeedChannel {
  title: string;
  link: string;
  description: string;
  language?: string;
  items: RssFeedItem[];
}

export function buildRssFeed(channel: RssFeedChannel): string {
  const itemsXml = channel.items.map(buildItemXml).join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    '  <channel>',
    `    <title>${escapeXml(channel.title)}</title>`,
    `    <link>${escapeXml(channel.link)}</link>`,
    `    <description>${escapeXml(channel.description)}</description>`,
    `    <language>${escapeXml(channel.language ?? 'en-us')}</language>`,
    `    <lastBuildDate>${toRfc822(new Date())}</lastBuildDate>`,
    itemsXml,
    '  </channel>',
    '</rss>',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

function buildItemXml(item: RssFeedItem): string {
  const lines = [
    '    <item>',
    `      <title>${escapeXml(item.title)}</title>`,
    `      <link>${escapeXml(item.link)}</link>`,
    `      <guid isPermaLink="false">${escapeXml(item.guid)}</guid>`,
    `      <pubDate>${toRfc822(item.pubDate)}</pubDate>`,
  ];

  if (item.description) {
    lines.push(`      <description>${escapeXml(item.description)}</description>`);
  }

  lines.push('    </item>');

  return lines.join('\n');
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toRfc822(date: Date): string {
  return date.toUTCString();
}
