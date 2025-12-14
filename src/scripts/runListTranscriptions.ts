import { NestFactory } from '@nestjs/core';
import * as dotenv from 'dotenv';

import { AppModule } from '../app.module';
import { ListTranscriptionsUseCase } from '../usecases/youtube-transcriptions/list-transcriptions.usecase';

dotenv.config();

async function initialize() {
  const app = await NestFactory.createApplicationContext(AppModule);
  return {
    app,
    listTranscriptionsUseCase: app.get(ListTranscriptionsUseCase),
  };
}

async function main() {
  console.log(
    `\n📋 YouTube Transcriptions List - ${new Date().toISOString()}\n`,
  );

  try {
    const services = await initialize();

    // Execute the usecase
    const result = await services.listTranscriptionsUseCase.execute({});

    if (result.statistics.total === 0) {
      console.log('No transcriptions found in the database.');
      await services.app.close();
      return;
    }

    console.log(`Found ${result.statistics.total} transcription(s)\n`);
    console.log(`========================================\n`);

    // Log each transcription with formatted details
    result.transcriptions.forEach((transcription, index) => {
      console.log(`\n${index + 1}. ID: ${transcription.id}`);
      console.log(`   Channel: ${transcription.channelName}`);
      console.log(`   Channel ID: ${transcription.channelId}`);
      console.log(`   Video Title: ${transcription.videoTitle}`);
      console.log(`   Video URL: ${transcription.videoUrl}`);
      console.log(
        `   Posted At: ${transcription.postedAt?.toISOString() || 'N/A'}`,
      );
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
    console.log(`Total transcriptions: ${result.statistics.total}`);
    console.log(`With summary: ${result.statistics.withSummary}`);
    console.log(`Without summary: ${result.statistics.withoutSummary}`);

    console.log(`\nTranscriptions by channel:`);
    Object.entries(result.statistics.channelCounts).forEach(
      ([channel, count]) => {
        console.log(`  - ${channel}: ${count}`);
      },
    );

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
