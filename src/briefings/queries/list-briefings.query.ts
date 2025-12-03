import { Injectable } from '@nestjs/common';
import { ArticlesService } from '../../articles/articles.service';
import { FeedProfile } from '../../shared/types/feed';
import { BriefingsService } from '../briefings.service';

@Injectable()
export class ListBriefingsQuery {
  constructor(
    private readonly articleService: ArticlesService,
    private readonly briefingsService: BriefingsService,
  ) {}

  async execute(feedProfile?: FeedProfile) {
    const availableProfiles =
      await this.articleService.getDistinctFeedProfiles();

    const briefings =
      await this.briefingsService.getAllBriefsMetadata(feedProfile);

    return {
      briefings,
      current_feed_profile: feedProfile,
      available_profiles: availableProfiles,
    };
  }
}
