import { Readability } from '@mozilla/readability';
import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { JSDOM } from 'jsdom';
import Parser from 'rss-parser';
import { ArticleContent } from '../articles/article.entity';
import { ArticlesService } from '../articles/articles.service';
import { ConfigService } from '../config/config.service';
import { ProfilesService } from '../profiles/profiles.service';
import { FeedProfile } from '../shared/types/feed';
import { ScrapingStats } from './scrapper.entity';

interface RSSEnclosure {
  type?: string;
  url?: string;
}

interface RSSMediaContent {
  medium?: string;
  type?: string;
  url?: string;
}

interface RSSImage {
  url?: string;
}

interface RSSMediaThumbnail {
  url?: string;
}

interface RSSEntry {
  enclosures?: RSSEnclosure[];
  mediaContent?: RSSMediaContent[];
  image?: RSSImage;
  mediaThumbnail?: RSSMediaThumbnail;
}

const rssParser = new Parser({
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['enclosure', 'enclosures'],
      ['media:thumbnail', 'mediaThumbnail'],
    ],
  },
});

@Injectable()
export class ScraperService {
  constructor(
    private readonly articlesService: ArticlesService,
    private readonly profilesService: ProfilesService,
    private readonly configService: ConfigService,
  ) { }

  async fetchArticleContentAndOgImage(url: string): Promise<ArticleContent> {
    let content: string | null = null;
    let ogImage: string | null = null;

    try {
      const headers = {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64; rv:137.0) Gecko/20100101 Firefox/137.0',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        Connection: 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
        referer: 'https://www.google.com',
      };

      const response = await axios.get(url, {
        headers,
        timeout: 20000,
      });

      const htmlContent = response.data as string;

      const dom = new JSDOM(htmlContent, { url });
      const reader = new Readability(dom.window.document);
      const article = reader.parse();

      if (article) {
        content = article.textContent;
      }

      const ogImageElement = dom.window.document.querySelector(
        'meta[property="og:image"]',
      );
      if (ogImageElement) {
        const ogImageContent = ogImageElement.getAttribute('content');
        if (ogImageContent) {
          ogImage = new URL(ogImageContent, url).href;
        }
      }

      return { content, ogImage };
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.error(`Error fetching ${url}:`, error.message);
      } else {
        console.error(`Error processing content/og:image from ${url}:`, error);
      }
      return { content, ogImage: null };
    }
  }

  private extractRssImageUrl(entry: RSSEntry): string | null {
    if (entry.enclosures && Array.isArray(entry.enclosures)) {
      for (const enclosure of entry.enclosures) {
        if (
          enclosure.type &&
          enclosure.type.startsWith('image/') &&
          enclosure.url
        ) {
          return enclosure.url;
        }
      }
    }

    if (entry.mediaContent && Array.isArray(entry.mediaContent)) {
      for (const media of entry.mediaContent) {
        if (media.medium === 'image' && media.url) {
          return media.url;
        }
        if (media.type && media.type.startsWith('image/') && media.url) {
          return media.url;
        }
      }
    }

    if (entry.image && typeof entry.image === 'object' && entry.image.url) {
      return entry.image.url;
    }

    if (entry.mediaThumbnail && entry.mediaThumbnail.url) {
      return entry.mediaThumbnail.url;
    }

    return null;
  }

  async scrapeSingleArticle(
    url: string,
    feedProfile: FeedProfile,
  ): Promise<number | null> {
    console.log(`\n--- Scraping single article: ${url} ---`);

    // Check if article already exists
    if (await this.articlesService.articleExists(url)) {
      console.log('Article already exists in database');
      return null;
    }

    // Fetch article content and OG image
    console.log('Fetching article content and OG image...');
    const { content: rawContent, ogImage: ogImageUrl } =
      await this.fetchArticleContentAndOgImage(url);

    if (!rawContent) {
      throw new Error('Failed to extract article content');
    }

    // Extract title from HTML
    let title = 'Untitled Article';
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (X11; Linux x86_64; rv:137.0) Gecko/20100101 Firefox/137.0',
        },
        timeout: 20000,
      });
      const htmlContent = response.data as string;
      const dom = new JSDOM(htmlContent, { url });

      // Try to extract title from various sources
      const titleElement = dom.window.document.querySelector('title');
      const ogTitleElement = dom.window.document.querySelector(
        'meta[property="og:title"]',
      );

      if (ogTitleElement && ogTitleElement.getAttribute('content')) {
        title = ogTitleElement.getAttribute('content') || title;
      } else if (titleElement && titleElement.textContent) {
        title = titleElement.textContent.trim();
      }
    } catch (error) {
      console.warn('Failed to extract title, using default', error);
    }

    // Use current date as published date
    const publishedDate = new Date();
    const feedSource = 'Manual';

    console.log(`Adding article: ${title}`);
    const articleId = await this.articlesService.addArticle(
      url,
      title,
      publishedDate,
      feedSource,
      rawContent,
      feedProfile,
      ogImageUrl || undefined,
    );

    if (articleId) {
      console.log(`Article added successfully with ID: ${articleId}`);
    }

    return articleId;
  }

  async scrapeArticles(
    feedProfile: FeedProfile,
    rssFeeds?: string[],
  ): Promise<ScrapingStats> {
    console.log(`\n--- Starting Article Scraping [${feedProfile}] ---`);

    const stats: ScrapingStats = {
      feedProfile,
      totalFeeds: 0,
      newArticles: 0,
      errors: 0,
      startTime: new Date(),
    };

    const feeds =
      rssFeeds ||
      this.profilesService
        .getEnabledFeedsForProfile(feedProfile)
        .map((f) => f.url);

    if (feeds.length === 0) {
      console.log(
        `Warning: No RSS feeds found for profile '${feedProfile}'. Skipping scrape.`,
      );
      stats.endTime = new Date();
      return stats;
    }

    stats.totalFeeds = feeds.length;

    for (const feedUrl of feeds) {
      console.log(`Fetching feed: ${feedUrl}`);

      try {
        const feed = await rssParser.parseURL(feedUrl);

        const appConfig = this.configService.getAppConfig();
        const maxArticlesForScrapping = appConfig.maxArticlesForScrapping || 15;
        const items = feed.items.slice(0, maxArticlesForScrapping);

        console.log('Processing items', {
          totalItemsInFeed: feed.items.length,
          itemsToProcess: items.length,
          maxArticlesForScrapping,
        });

        for (const entry of items) {
          const url = entry.link;
          const title = entry.title || 'No Title';
          const publishedDate = entry.pubDate
            ? new Date(entry.pubDate)
            : new Date();
          const feedSource = feed.title || feedUrl;

          if (!url) {
            continue;
          }

          if (await this.articlesService.articleExists(url)) {
            continue;
          }

          console.log(`Processing new entry: ${title} (${url})`);

          const rssImageUrl = this.extractRssImageUrl(entry as RSSEntry);
          if (rssImageUrl) {
            console.log(
              `  Found image in RSS: ${rssImageUrl.substring(0, 60)}...`,
            );
          }

          console.log(`  Fetching article content and OG image...`);
          const { content: rawContent, ogImage: ogImageUrl } =
            await this.fetchArticleContentAndOgImage(url);

          if (!rawContent) {
            console.log(
              `  Skipping article, failed to extract main content: ${title}`,
            );
            stats.errors++;
            continue;
          }

          const finalImageUrl = rssImageUrl || ogImageUrl;
          if (finalImageUrl) {
            console.log(
              `  Using image URL: ${finalImageUrl.substring(0, 60)}...`,
            );
          } else {
            console.log('  No image found in RSS or OG tags.');
          }

          const articleId = await this.articlesService.addArticle(
            url,
            title,
            publishedDate,
            feedSource,
            rawContent,
            feedProfile,
            finalImageUrl || undefined,
          );

          if (articleId) {
            stats.newArticles++;
          }

          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error(`Error processing feed ${feedUrl}:`, error);
        stats.errors++;
      }
    }

    stats.endTime = new Date();
    console.log(
      `--- Scraping Finished [${feedProfile}]. Added ${stats.newArticles} new articles. ---`,
    );

    return stats;
  }
}
