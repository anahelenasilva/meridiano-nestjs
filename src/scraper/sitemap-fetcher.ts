import axios from 'axios';

export interface SitemapEntry {
  url: string;
  lastmod: Date | null;
}

const SITEMAP_USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64; rv:137.0) Gecko/20100101 Firefox/137.0';

export function parseSitemapXml(
  xml: string,
  urlPrefix: string,
): SitemapEntry[] {
  const urlBlocks = xml.match(/<url\b[^>]*>[\s\S]*?<\/url>/g) ?? [];
  const entries: SitemapEntry[] = [];

  for (const block of urlBlocks) {
    const loc = block.match(/<loc>\s*([\s\S]*?)\s*<\/loc>/)?.[1]?.trim();
    if (!loc || !loc.startsWith(urlPrefix)) {
      continue;
    }

    const lastmodRaw = block
      .match(/<lastmod>\s*([\s\S]*?)\s*<\/lastmod>/)?.[1]
      ?.trim();
    const parsed = lastmodRaw ? new Date(lastmodRaw) : null;
    const lastmod =
      parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;

    entries.push({ url: loc, lastmod });
  }

  return entries;
}

export async function fetchSitemapEntries(
  sitemapUrl: string,
  urlPrefix: string,
): Promise<SitemapEntry[]> {
  const response = await axios.get<string>(sitemapUrl, {
    timeout: 20000,
    responseType: 'text',
    headers: { 'User-Agent': SITEMAP_USER_AGENT },
  });

  return parseSitemapXml(response.data, urlPrefix);
}
