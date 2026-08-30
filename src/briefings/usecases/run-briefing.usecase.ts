import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
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
import { ScrapeSitemapsUseCase } from './scrape-sitemaps.usecase';

@Injectable()
export class RunBriefingUseCase {
  private readonly logger = new Logger(RunBriefingUseCase.name);

  constructor(
    private readonly scrapeArticlesUseCase: ScrapeArticlesUseCase,
    private readonly scrapeSitemapsUseCase: ScrapeSitemapsUseCase,
    private readonly processArticlesUseCase: ProcessArticlesUseCase,
    private readonly rateArticlesUseCase: RateArticlesUseCase,
    private readonly categorizeArticlesUseCase: CategorizeArticlesUseCase,
    private readonly generateBriefUseCase: GenerateBriefUseCase,
    private readonly profilesService: ProfilesService,
    private readonly configService: ConfigService,
  ) {}

  async execute(input: RunBriefingInputDto): Promise<RunBriefingOutputDto> {
    const startTime = new Date();

    const enabledFeeds = this.profilesService.getEnabledFeedsForProfile(
      input.feedProfile,
    );
    const enabledSitemapSources =
      this.profilesService.getEnabledSitemapSourcesForProfile(
        input.feedProfile,
      );

    if (enabledFeeds.length === 0 && enabledSitemapSources.length === 0) {
      this.logger.warn(
        `No enabled feeds or sitemap sources found for profile '${input.feedProfile}'.`,
      );

      return {
        success: false,
        duration: 0,
        error: `No enabled feeds or sitemap sources found for profile '${input.feedProfile}'.`,
      };
    }

    const feedUrls = enabledFeeds.map((f) => f.url);

    const scrapingStats = await this.scrapeArticlesUseCase.execute({
      feedProfile: input.feedProfile,
      feedUrls,
    });

    const sitemapScrapingStats = await this.scrapeSitemapsUseCase.execute({
      feedProfile: input.feedProfile,
    });

    const processingStats = await this.processArticlesUseCase.execute({
      feedProfile: input.feedProfile,
    });

    const ratingStats = await this.rateArticlesUseCase.execute({
      feedProfile: input.feedProfile,
    });

    const categorizationStats = await this.categorizeArticlesUseCase.execute({
      feedProfile: input.feedProfile,
    });

    let briefResult;
    if (this.configService.isBriefingsGenerationEnabled()) {
      briefResult = await this.generateBriefUseCase.execute({
        feedProfile: input.feedProfile,
      });
    } else {
      this.logger.warn(
        'Briefings generation is disabled. Skipping brief generation stage.',
      );
      briefResult = {
        success: false,
        briefingId: undefined,
        stats: undefined,
        error:
          'Briefings generation is disabled. Set ENABLE_BRIEFINGS_GENERATION=true to enable.',
      };
    }

    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;

    return {
      success: briefResult.success,
      duration,
      stages: {
        scraping: scrapingStats,
        sitemapScraping: sitemapScrapingStats,
        processing: processingStats,
        rating: ratingStats,
        categorization: categorizationStats,
        briefGeneration: briefResult,
      },
    };
  }
}
