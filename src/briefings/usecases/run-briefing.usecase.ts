import { Injectable, Logger } from '@nestjs/common';
import { ProcessorService } from '../../processor/processor.service';
import { ScraperService } from '../../scraper/scraper.service';
import {
  RunBriefingInputDto,
  RunBriefingOutputDto,
} from './dto/run-briefing.dto';
import { GenerateBriefUseCase } from './generate-brief.usecase';

/**
 * One Standard Briefing run for a Feed Profile: scrape its sources, then
 * summarise, rate and categorise the waiting articles, then generate the brief.
 */
@Injectable()
export class RunBriefingUseCase {
  private readonly logger = new Logger(RunBriefingUseCase.name);

  constructor(
    private readonly scraperService: ScraperService,
    private readonly processorService: ProcessorService,
    private readonly generateBriefUseCase: GenerateBriefUseCase,
  ) {}

  async execute({
    feedProfile,
  }: RunBriefingInputDto): Promise<RunBriefingOutputDto> {
    const startTime = Date.now();

    const scrape = await this.scraperService.scrapeFeedProfile(feedProfile);

    if (scrape.status === 'no_sources') {
      const error = `No enabled feeds or sitemap sources found for profile '${feedProfile}'.`;
      this.logger.warn(error);

      return { success: false, duration: 0, error };
    }

    const processing =
      await this.processorService.processArticles(feedProfile);
    const rating = await this.processorService.rateArticles(feedProfile);
    const categorization =
      await this.processorService.categorizeArticles(feedProfile);
    const briefGeneration = await this.generateBriefUseCase.execute({
      feedProfile,
    });

    return {
      success: briefGeneration.success,
      duration: (Date.now() - startTime) / 1000,
      stages: {
        scraping: scrape.rss,
        sitemapScraping: scrape.sitemap,
        processing,
        rating,
        categorization,
        briefGeneration,
      },
    };
  }
}
