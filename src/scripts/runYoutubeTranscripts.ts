import { NestFactory } from '@nestjs/core';
import * as dotenv from 'dotenv';

import { AppModule } from '../app.module';
import { ChannelConfig } from '../shared/types/channel';
import { YoutubeChannelsService } from '../youtube-channels/youtube-channels.service';
import { ExtractYoutubeTranscriptsUseCase } from '../youtube-transcriptions/usecases/extract-youtube-transcripts.usecase';

dotenv.config();

async function initialize() {
  const app = await NestFactory.createApplicationContext(AppModule);
  return {
    app,
    extractYoutubeTranscriptsUseCase: app.get(ExtractYoutubeTranscriptsUseCase),
    youtubeChannelsService: app.get(YoutubeChannelsService),
  };
}

async function main() {
  console.log(
    `\n🎥 YouTube Transcript Extractor - ${new Date().toISOString()}\n`,
  );

  try {
    const services = await initialize();
    const enabledChannels =
      await services.youtubeChannelsService.getEnabledChannels();

    const channels: ChannelConfig[] = enabledChannels.map((channel) => ({
      databaseId: channel.id,
      channelId: channel.channelId,
      channelName: channel.name,
      channelDescription: channel.description || '',
      maxVideos: channel.maxVideos || 1, // Default to 1 if not specified
    }));

    if (channels.length === 0) {
      console.log(
        '⚠️  No enabled channels configured. Please add channels to config.youtubeTranscriptions.channels and set enabled to true',
      );

      await services.app.close();
      return;
    }

    console.log(`Found ${channels.length} channel(s) to process:\n`);

    channels.forEach((channel, index) => {
      console.log(
        `${index + 1}. ${channel.channelName} (${channel.channelId})`,
      );
      console.log(`   Description: ${channel.channelDescription}`);
      console.log(`   Max videos: ${channel.maxVideos}`);
    });

    console.log();

    const result = await services.extractYoutubeTranscriptsUseCase.execute({
      channels,
    });

    if (result.success) {
      console.log(
        `\n✓ Successfully processed ${result.channelsProcessed} channel(s)`,
      );
    } else {
      console.error(`\n❌ Error: ${result.message}`);
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
