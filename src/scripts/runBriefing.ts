import { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Command } from 'commander';
import * as dotenv from 'dotenv';
import { AppModule } from '../app.module';
import { GenerateBriefUseCase } from '../briefings/usecases/generate-brief.usecase';
import { RunBriefingUseCase } from '../briefings/usecases/run-briefing.usecase';
import { ProcessorService } from '../processor/processor.service';
import { ProfilesService } from '../profiles/profiles.service';
import { ScraperService } from '../scraper/scraper.service';
import { FeedProfile } from '../shared/types/feed';

dotenv.config();

const program = new Command();

interface Services {
  app: INestApplicationContext;
  runBriefingUseCase: RunBriefingUseCase;
  scraperService: ScraperService;
  processorService: ProcessorService;
  generateBriefUseCase: GenerateBriefUseCase;
  profilesService: ProfilesService;
}

async function initialize(): Promise<Services> {
  const app = await NestFactory.createApplicationContext(AppModule);
  return {
    app,
    runBriefingUseCase: app.get(RunBriefingUseCase),
    scraperService: app.get(ScraperService),
    processorService: app.get(ProcessorService),
    generateBriefUseCase: app.get(GenerateBriefUseCase),
    profilesService: app.get(ProfilesService),
  };
}

program
  .name('meridian-briefing')
  .description(
    'Meridian Briefing System - AI-powered news analysis and briefing generation',
  )
  .version('1.0.0');

program
  .option('-f, --feed <profile>', 'Specify the feed profile name', 'default')
  .option('--scrape', 'Run only the article scraping stage')
  .option(
    '--process',
    'Run only the article processing (summarize, embed) stage',
  )
  .option('--rate', 'Run only the article impact rating stage')
  .option('--categorize', 'Run only the article categorization stage')
  .option('--generate', 'Run only the brief generation stage')
  .option('--all', 'Run all stages sequentially (default behavior)')
  .option('--generate-audio', 'Generate audio for article summaries');

program.parse();

interface ProgramOptions {
  feed?: string;
  scrape?: boolean;
  process?: boolean;
  rate?: boolean;
  categorize?: boolean;
  generate?: boolean;
  all?: boolean;
  generateAudio?: boolean;
}

const options: ProgramOptions = program.opts();

async function main(): Promise<void> {
  try {
    const services = await initialize();

    const feedProfile = options.feed as FeedProfile;
    const availableProfiles = services.profilesService.getAvailableProfiles();

    if (!availableProfiles.includes(feedProfile)) {
      console.error(`Error: Feed profile '${feedProfile}' not found.`);
      console.log('Available profiles:', availableProfiles.join(', '));
      process.exit(1);
    }

    console.log(
      `\nMeridian Briefing Run [${feedProfile}] - ${new Date().toISOString()}`,
    );

    const hasSpecificStage =
      options.scrape ||
      options.process ||
      options.rate ||
      options.categorize ||
      options.generate ||
      options.generateAudio;

    const shouldRunAll = options.all || !hasSpecificStage;

    if (shouldRunAll) {
      console.log(`\n>>> Running ALL stages for [${feedProfile}] <<<`);

      try {
        const result = await services.runBriefingUseCase.execute({
          feedProfile,
        });

        if (!result.success || !result.stages) {
          console.error(
            `Briefing run failed: ${result.error || 'Unknown error'}`,
          );
          process.exit(1);
        }

        console.log(
          `\nScraping completed. New articles: ${result.stages.scraping.newArticles}, Errors: ${result.stages.scraping.errors}`,
        );
        console.log(
          `Sitemap scraping completed. New articles: ${result.stages.sitemapScraping.newArticles}, Errors: ${result.stages.sitemapScraping.errors}`,
        );
        console.log(
          `Processing completed. Processed: ${result.stages.processing.articlesProcessed}, Errors: ${result.stages.processing.errors}`,
        );
        console.log(
          `Rating completed. Rated: ${result.stages.rating.articlesRated}, Errors: ${result.stages.rating.errors}`,
        );
        console.log(
          `Categorization completed. Categorized: ${result.stages.categorization.articlesCategorized}, Errors: ${result.stages.categorization.errors}`,
        );

        if (result.stages.briefGeneration.success) {
          console.log(
            `Brief generated successfully. ID: ${result.stages.briefGeneration.briefingId}`,
          );
          if (result.stages.briefGeneration.stats) {
            console.log(
              `Stats: ${result.stages.briefGeneration.stats.articlesAnalyzed} articles, ${result.stages.briefGeneration.stats.clustersUsed} clusters`,
            );
          }
        } else {
          console.error(
            `Brief generation failed: ${result.stages.briefGeneration.error}`,
          );
        }

        console.log(
          `\n✓ All stages completed in ${result.duration.toFixed(1)} seconds`,
        );
      } catch (error) {
        console.error('Error during execution:', error);
        process.exit(1);
      }
    } else {
      if (options.scrape) {
        const result =
          await services.scraperService.scrapeFeedProfile(feedProfile);
        if (result.status === 'no_sources') {
          console.log(
            `No enabled feeds or sitemap sources found for profile '${feedProfile}'.`,
          );
        } else {
          console.log(
            `Scraping completed. New articles: ${result.rss.newArticles}, Errors: ${result.rss.errors}`,
          );
          console.log(
            `Sitemap scraping completed. New articles: ${result.sitemap.newArticles}, Errors: ${result.sitemap.errors}`,
          );
        }
      }

      if (options.process) {
        const result = await services.processorService.processArticles(
          feedProfile,
          options.generateAudio,
        );
        console.log(
          `Processing completed. Processed: ${result.articlesProcessed}, Errors: ${result.errors}`,
        );
      }

      if (options.rate) {
        const result =
          await services.processorService.rateArticles(feedProfile);
        console.log(
          `Rating completed. Rated: ${result.articlesRated}, Errors: ${result.errors}`,
        );
      }

      if (options.categorize) {
        const result =
          await services.processorService.categorizeArticles(feedProfile);
        console.log(
          `Categorization completed. Categorized: ${result.articlesCategorized}, Errors: ${result.errors}`,
        );
      }

      if (options.generate) {
        const result = await services.generateBriefUseCase.execute({
          feedProfile,
        });
        if (result.success) {
          console.log(`Brief generated successfully. ID: ${result.briefingId}`);
        } else {
          console.error(`Brief generation failed: ${result.error}`);
        }
      }
    }

    console.log(
      `\nRun Finished [${feedProfile}] - ${new Date().toISOString()}`,
    );

    await services.app.close();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
