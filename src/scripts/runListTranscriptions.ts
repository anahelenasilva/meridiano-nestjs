import { NestFactory } from '@nestjs/core';
import * as dotenv from 'dotenv';

import { AppModule } from '../app.module';
import { YoutubeTranscriptionsService } from '../youtube-transcriptions/youtube-transcriptions.service';

dotenv.config();

async function initialize() {
  const app = await NestFactory.createApplicationContext(AppModule);
  return {
    app,
    youtubeTranscriptionsService: app.get(YoutubeTranscriptionsService),
  };
}

async function main() {
  console.log(
    `\n📋 YouTube Transcriptions List - ${new Date().toISOString()}\n`,
  );

  try {
    const services = await initialize();

    // Get all transcriptions from the database
    const transcriptions =
      await services.youtubeTranscriptionsService.getAllTranscriptions();

    if (transcriptions.length === 0) {
      console.log('No transcriptions found in the database.');
      await services.app.close();
      return;
    }

    console.log(`Found ${transcriptions.length} transcription(s)\n`);
    console.log(`========================================\n`);

    // Log each transcription with formatted details
    transcriptions.forEach((transcription, index) => {
      console.log(`\n${index + 1}. ID: ${transcription.id}`);
      console.log(`   Channel: ${transcription.channelName}`);
      console.log(`   Channel ID: ${transcription.channelId}`);
      console.log(`   Video Title: ${transcription.videoTitle}`);
      console.log(`   Video URL: ${transcription.videoUrl}`);
      console.log(`   Posted At: ${transcription.postedAt?.toISOString() || 'N/A'}`);
      console.log(
        `   Processed At: ${transcription.processedAt.toISOString()}`,
      );
      console.log(
        `   Transcription Length: ${transcription.transcriptionText?.length || 0} chars`,
      );
      console.log(
        `   Has Summary: ${transcription.transcriptionSummary ? 'Yes' : 'No'}`,
      );

      if (transcription.transcriptionSummary) {
        console.log(
          `   Summary Preview: ${transcription.transcriptionSummary.substring(0, 150)}...`,
        );
      }

      console.log(`   ----------------------------------------`);
    });

    console.log(`\n========================================`);
    console.log(`📊 Summary`);
    console.log(`========================================`);
    console.log(`Total transcriptions: ${transcriptions.length}`);

    const withSummary = transcriptions.filter(
      (t) => t.transcriptionSummary,
    ).length;
    const withoutSummary = transcriptions.length - withSummary;

    console.log(`With summary: ${withSummary}`);
    console.log(`Without summary: ${withoutSummary}`);

    const channelCounts = transcriptions.reduce(
      (acc, t) => {
        acc[t.channelName] = (acc[t.channelName] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    console.log(`\nTranscriptions by channel:`);
    Object.entries(channelCounts).forEach(([channel, count]) => {
      console.log(`  - ${channel}: ${count}`);
    });

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
