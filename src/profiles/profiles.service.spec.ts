import { ProfilesService } from './profiles.service';
import { FeedProfile } from '../shared/types/feed';

describe('ProfilesService sitemap sources', () => {
  let service: ProfilesService;

  beforeEach(() => {
    service = new ProfilesService();
  });

  it('returns configured sitemap sources for the technology profile', () => {
    const sources = service.getSitemapSourcesForProfile(FeedProfile.TECHNOLOGY);
    const urls = sources.map((s) => s.sitemapUrl);

    expect(urls).toContain('https://claude.com/sitemap.xml');
    expect(urls).toContain('https://www.anthropic.com/sitemap.xml');
  });

  it('filters out sitemap sources with enabled === false', () => {
    const enabled = service.getEnabledSitemapSourcesForProfile(
      FeedProfile.TECHNOLOGY,
    );
    expect(enabled.every((s) => s.enabled !== false)).toBe(true);
  });

  it('returns an empty array for a profile without sitemap sources', () => {
    expect(service.getSitemapSourcesForProfile(FeedProfile.POLITICS)).toEqual([]);
  });
});
