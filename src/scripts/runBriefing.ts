import { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Command } from 'commander';
import * as dotenv from 'dotenv';
import { AiService } from '../ai/ai.service';
import { AppModule } from '../app.module';
import { BriefingService } from '../briefing/briefing.service';
import { ConfigService } from '../config/config.service';
import { ProcessorService } from '../processor/processor.service';
import { ProfilesService } from '../profiles/profiles.service';
import { ScraperService } from '../scraper/scraper.service';
import { FeedProfile } from '../shared/types/feed';

dotenv.config();

const program = new Command();

interface Services {
  app: INestApplicationContext;
  scraperService: ScraperService;
  processorService: ProcessorService;
  briefingService: BriefingService;
  profilesService: ProfilesService;
  aiService: AiService;
  configService: ConfigService;
}

async function initialize(): Promise<Services> {
  const app = await NestFactory.createApplicationContext(AppModule);
  return {
    app,
    scraperService: app.get(ScraperService),
    processorService: app.get(ProcessorService),
    briefingService: app.get(BriefingService),
    profilesService: app.get(ProfilesService),
    aiService: app.get(AiService),
    configService: app.get(ConfigService),
  };
}

async function runAll(
  services: Services,
  feedProfile: FeedProfile,
): Promise<void> {
  console.log(`\n>>> Running ALL stages for [${feedProfile}] <<<`);

  const startTime = new Date();

  try {
    const enabledFeeds =
      services.profilesService.getEnabledFeedsForProfile(feedProfile);
    if (enabledFeeds.length === 0) {
      console.log(
        `Warning: No enabled feeds found for profile '${feedProfile}'.`,
      );
      return;
    }

    const feedUrls = enabledFeeds.map((f) => f.url);

    console.log('\n--- Stage 1: Scraping Articles ---');
    const scrapingStats = await services.scraperService.scrapeArticles(
      feedProfile,
      feedUrls,
    );
    console.log(
      `Scraping completed. New articles: ${scrapingStats.newArticles}, Errors: ${scrapingStats.errors}`,
    );

    console.log('\n--- Stage 2: Processing Articles ---');
    const processingStats =
      await services.processorService.processArticles(feedProfile);
    console.log(
      `Processing completed. Processed: ${processingStats.articlesProcessed}, Errors: ${processingStats.errors}`,
    );

    console.log('\n--- Stage 3: Rating Articles ---');
    const ratingStats =
      await services.processorService.rateArticles(feedProfile);
    console.log(
      `Rating completed. Rated: ${ratingStats.articlesRated}, Errors: ${ratingStats.errors}`,
    );

    console.log('\n--- Stage 4: Categorizing Articles ---');
    const categorizationStats =
      await services.processorService.categorizeArticles(feedProfile);
    console.log(
      `Categorization completed. Categorized: ${categorizationStats.articlesCategorized}, Errors: ${categorizationStats.errors}`,
    );

    console.log('\n--- Stage 5: Generating Brief ---');
    const briefResult =
      await services.briefingService.generateBrief(feedProfile);

    if (briefResult.success) {
      console.log(
        `Brief generated successfully. ID: ${briefResult.briefingId}`,
      );
      if (briefResult.stats) {
        console.log(
          `Stats: ${briefResult.stats.articlesAnalyzed} articles, ${briefResult.stats.clustersUsed} clusters`,
        );
      }
    } else {
      console.error(`Brief generation failed: ${briefResult.error}`);
    }

    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;
    console.log(`\n✓ All stages completed in ${duration.toFixed(1)} seconds`);
  } catch (error) {
    console.error('Error during execution:', error);
    process.exit(1);
  }
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
  .option('--simple-brief', 'Generate a simple brief without clustering');

program.parse();

interface ProgramOptions {
  feed?: string;
  scrape?: boolean;
  process?: boolean;
  rate?: boolean;
  categorize?: boolean;
  generate?: boolean;
  all?: boolean;
  simpleBrief?: boolean;
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
      options.generate;
    const shouldRunAll = options.all || !hasSpecificStage;

    if (options.simpleBrief) {
      console.log('\n>>> Generating Simple Brief <<<');
      const result =
        await services.briefingService.generateSimpleBrief(feedProfile);
      if (result.success) {
        console.log(
          `Simple brief generated successfully. ID: ${result.briefingId}`,
        );
      } else {
        console.error(`Simple brief generation failed: ${result.error}`);
      }
    } else if (shouldRunAll) {
      await runAll(services, feedProfile);
    } else {
      if (options.scrape) {
        const enabledFeeds =
          services.profilesService.getEnabledFeedsForProfile(feedProfile);
        const feedUrls = enabledFeeds.map((f) => f.url);
        const stats = await services.scraperService.scrapeArticles(
          feedProfile,
          feedUrls,
        );
        console.log(
          `Scraping completed. New articles: ${stats.newArticles}, Errors: ${stats.errors}`,
        );
      }

      if (options.process) {
        const stats =
          await services.processorService.processArticles(feedProfile);
        console.log(
          `Processing completed. Processed: ${stats.articlesProcessed}, Errors: ${stats.errors}`,
        );
      }

      if (options.rate) {
        const stats = await services.processorService.rateArticles(feedProfile);
        console.log(
          `Rating completed. Rated: ${stats.articlesRated}, Errors: ${stats.errors}`,
        );
      }

      if (options.categorize) {
        const stats =
          await services.processorService.categorizeArticles(feedProfile);
        console.log(
          `Categorization completed. Categorized: ${stats.articlesCategorized}, Errors: ${stats.errors}`,
        );
      }

      if (options.generate) {
        const result =
          await services.briefingService.generateBrief(feedProfile);
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
