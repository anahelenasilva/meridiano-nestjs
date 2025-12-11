import { NestFactory } from '@nestjs/core';
import * as dotenv from 'dotenv';
import * as fs from 'fs/promises';
import * as path from 'path';

import { AppModule } from '../app.module';
import { ConfigService } from '../config/config.service';
import { VideoWithTranscript } from '../shared/types/video';
import { YoutubeTranscriptionsService } from '../youtube-transcriptions/youtube-transcriptions.service';

dotenv.config();

interface ProcessingStats {
  totalFiles: number;
  processed: number;
  skipped: number;
  errors: number;
  errorDetails: Array<{ file: string; error: string }>;
}

async function initialize() {
  const app = await NestFactory.createApplicationContext(AppModule);
  await app.init(); // Initialize the application to trigger onModuleInit hooks
  return {
    app,
    youtubeTranscriptionsService: app.get(YoutubeTranscriptionsService),
    configService: app.get(ConfigService),
  };
}

async function main() {
  console.log(
    `\n📺 YouTube Transcription Processor - ${new Date().toISOString()}\n`,
  );

  const stats: ProcessingStats = {
    totalFiles: 0,
    processed: 0,
    skipped: 0,
    errors: 0,
    errorDetails: [],
  };

  try {
    const services = await initialize();
    const ytConfig = services.configService.getYoutubeChannelsConfig();
    const transcriptsDir = path.join(process.cwd(), 'transcripts');

    try {
      await fs.access(transcriptsDir);
    } catch {
      console.log(`⚠️  Transcripts directory not found at: ${transcriptsDir}`);
      console.log('No transcription files to process.');
      await services.app.close();
      return;
    }

    const files = await fs.readdir(transcriptsDir);
    const jsonFiles = files.filter(
      (file) => file.endsWith('.json') && !file.startsWith('.'),
    );

    if (jsonFiles.length === 0) {
      console.log('No transcription JSON files found to process.');
      await services.app.close();
      return;
    }

    stats.totalFiles = jsonFiles.length;
    console.log(`Found ${jsonFiles.length} transcription file(s) to process\n`);

    for (const filename of jsonFiles) {
      console.log(`\n----------------------------------------`);
      console.log(`Processing file: ${filename}`);

      try {
        const filePath = path.join(transcriptsDir, filename);

        const fileContent = await fs.readFile(filePath, 'utf-8');
        const videoData: VideoWithTranscript = JSON.parse(fileContent);

        if (!videoData.channel?.id) {
          console.log(
            `  ⚠️  Warning: Could not extract channel ID from video data. Skipping.`,
          );
          stats.skipped++;
          continue;
        }

        const channelData = ytConfig.channels[videoData.channel.id];

        if (!channelData) {
          console.log(
            `  ⚠️  Warning: Channel ID ${videoData.channel.id} and name ${videoData.channel.name} not found in config. Skipping.`,
          );
          stats.skipped++;
          continue;
        }

        if (channelData.enabled === false) {
          console.log(
            `  ⚠️  Channel ${channelData.name} is disabled. Skipping.`,
          );
          stats.skipped++;
          continue;
        }

        const channelName = channelData.name;

        console.log(`  Channel: ${channelName}`);
        console.log(`  Channel ID: ${videoData.channel.id}`);

        const result =
          await services.youtubeTranscriptionsService.processTranscriptionFile(
            videoData,
          );

        if (result.success) {
          stats.processed++;
        } else {
          stats.errors++;
          const errorMsg = result.error || 'Unknown error';
          stats.errorDetails.push({ file: filename, error: errorMsg });
          console.log(`  ✗ Error: ${errorMsg}`);
        }
      } catch (error) {
        stats.errors++;
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        stats.errorDetails.push({ file: filename, error: errorMessage });
        console.error(`  ✗ Unexpected error processing ${filename}:`, error);
      }
    }

    console.log(`\n========================================`);
    console.log(`📊 Processing Summary`);
    console.log(`========================================`);
    console.log(`Total files found: ${stats.totalFiles}`);
    console.log(`Successfully processed: ${stats.processed}`);
    console.log(`Skipped: ${stats.skipped}`);
    console.log(`Errors: ${stats.errors}`);

    if (stats.errorDetails.length > 0) {
      console.log(`\nError Details:`);
      stats.errorDetails.forEach(({ file, error }) => {
        console.log(`  - ${file}: ${error}`);
      });
    }

    console.log(`\n✓ Script finished - ${new Date().toISOString()}\n`);

    await services.app.close();
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
