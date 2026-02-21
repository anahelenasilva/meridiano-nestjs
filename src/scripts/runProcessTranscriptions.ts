import { NestFactory } from '@nestjs/core';
import { Command } from 'commander';
import * as dotenv from 'dotenv';

import { AppModule } from '../app.module';
import { ProcessTranscriptionFilesUseCase } from '../youtube-transcriptions/usecases/process-transcription-files.usecase';

dotenv.config();

const program = new Command();

program
  .name('process-transcriptions')
  .description('Process YouTube transcription files')
  .version('1.0.0')
  .option('--generate-audio', 'Generate audio for transcription summaries');

program.parse();

interface ProgramOptions {
  generateAudio?: boolean;
}

const options: ProgramOptions = program.opts();

async function initialize() {
  const app = await NestFactory.createApplicationContext(AppModule);
  await app.init(); // Initialize the application to trigger onModuleInit hooks
  return {
    app,
    processTranscriptionFilesUseCase: app.get(ProcessTranscriptionFilesUseCase),
  };
}

async function main() {
  console.log(
    `\n📺 YouTube Transcription Processor - ${new Date().toISOString()}\n`,
  );

  try {
    const services = await initialize();

    const stats = await services.processTranscriptionFilesUseCase.execute({
      generateAudio: options.generateAudio,
    });

    if (stats.totalFiles === 0) {
      console.log('No transcription files found to process.');
      await services.app.close();
      return;
    }

    console.log(`Found ${stats.totalFiles} transcription file(s) to process\n`);

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
