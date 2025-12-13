import { Injectable } from '@nestjs/common';
import { ProfilesService } from '../../profiles/profiles.service';
import { CategorizeArticlesUseCase } from './categorize-articles.usecase';
import {
  RunBriefingInputDto,
  RunBriefingOutputDto,
} from './dto/run-briefing.dto';
import { GenerateBriefUseCase } from './generate-brief.usecase';
import { ProcessArticlesUseCase } from './process-articles.usecase';
import { RateArticlesUseCase } from './rate-articles.usecase';
import { ScrapeArticlesUseCase } from './scrape-articles.usecase';

@Injectable()
export class RunBriefingUseCase {
  constructor(
    private readonly scrapeArticlesUseCase: ScrapeArticlesUseCase,
    private readonly processArticlesUseCase: ProcessArticlesUseCase,
    private readonly rateArticlesUseCase: RateArticlesUseCase,
    private readonly categorizeArticlesUseCase: CategorizeArticlesUseCase,
    private readonly generateBriefUseCase: GenerateBriefUseCase,
    private readonly profilesService: ProfilesService,
  ) { }

  async execute(input: RunBriefingInputDto): Promise<RunBriefingOutputDto> {
    const startTime = new Date();

    // Get enabled feeds for the profile
    const enabledFeeds = this.profilesService.getEnabledFeedsForProfile(
      input.feedProfile,
    );

    if (enabledFeeds.length === 0) {
      throw new Error(
        `No enabled feeds found for profile '${input.feedProfile}'.`,
      );
    }

    const feedUrls = enabledFeeds.map((f) => f.url);

    // Stage 1: Scraping
    const scrapingStats = await this.scrapeArticlesUseCase.execute({
      feedProfile: input.feedProfile,
      feedUrls,
    });

    // Stage 2: Processing
    const processingStats = await this.processArticlesUseCase.execute({
      feedProfile: input.feedProfile,
    });

    // Stage 3: Rating
    const ratingStats = await this.rateArticlesUseCase.execute({
      feedProfile: input.feedProfile,
    });

    // Stage 4: Categorization
    const categorizationStats = await this.categorizeArticlesUseCase.execute({
      feedProfile: input.feedProfile,
    });

    // Stage 5: Brief Generation
    const briefResult = await this.generateBriefUseCase.execute({
      feedProfile: input.feedProfile,
    });

    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;

    return {
      success: briefResult.success,
      duration,
      stages: {
        scraping: scrapingStats,
        processing: processingStats,
        rating: ratingStats,
        categorization: categorizationStats,
        briefGeneration: briefResult,
      },
    };
  }
}
