import { Injectable } from '@nestjs/common';
import { brasilFeedConfig } from '../shared/feeds/brasil';
import { techFeedConfig } from '../shared/feeds/tech';
import { teclasFeedConfig } from '../shared/feeds/teclas';
import { FeedConfiguration, FeedProfile, RSSFeed } from '../shared/types/feed';

@Injectable()
export class ProfilesService {
  private feedConfigurations: Map<FeedProfile, FeedConfiguration> = new Map();

  constructor() {
    this.registerFeedConfig(techFeedConfig);
    this.registerFeedConfig(brasilFeedConfig);
    this.registerFeedConfig(teclasFeedConfig);
  }

  registerFeedConfig(config: FeedConfiguration): void {
    this.feedConfigurations.set(config.profile, config);
  }

  getFeedConfig(profile: FeedProfile): FeedConfiguration | undefined {
    return this.feedConfigurations.get(profile);
  }

  getAvailableProfiles(): FeedProfile[] {
    return Array.from(this.feedConfigurations.keys());
  }

  getFeedsForProfile(profile: FeedProfile): RSSFeed[] {
    const config = this.getFeedConfig(profile);
    return config?.rssFeeds || [];
  }

  getEnabledFeedsForProfile(profile: FeedProfile): RSSFeed[] {
    const feeds = this.getFeedsForProfile(profile);
    return feeds.filter((feed) => feed.enabled !== false);
  }

  getPromptsForProfile(profile: FeedProfile) {
    const config = this.getFeedConfig(profile);
    return config?.prompts || {};
  }
}
