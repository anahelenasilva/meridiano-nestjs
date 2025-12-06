import { NestFactory } from '@nestjs/core';
import * as dotenv from 'dotenv';

import { AppModule } from '../app.module';
import { ConfigService } from '../config/config.service';
import { ChannelConfig } from '../shared/types/channel';
import { YoutubeTranscriptionsService } from '../youtube-transcriptions/youtube-transcriptions.service';

dotenv.config();

async function initialize() {
  const app = await NestFactory.createApplicationContext(AppModule);
  return {
    app,
    youtubeTranscriptionsService: app.get(YoutubeTranscriptionsService),
    configService: app.get(ConfigService),
  };
}

async function main() {
  console.log(
    `\n🎥 YouTube Transcript Extractor - ${new Date().toISOString()}\n`,
  );

  try {
    const services = await initialize();
    const ytConfig = services.configService.getYoutubeChannelsConfig();

    // Convert config channels to ChannelConfig array
    const channels: ChannelConfig[] = Object.entries(ytConfig.channels).map(
      ([channelId, channelData]) => ({
        channelId,
        channelName: channelData.name,
        channelDescription: channelData.description,
        maxVideos: ytConfig.maxVideosPerChannel,
      }),
    );

    if (channels.length === 0) {
      console.log(
        '⚠️  No channels configured. Please add channels to config.youtubeTranscriptions.channels',
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

    // Extract transcripts from all channels
    await services.youtubeTranscriptionsService.extractAll(channels);

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
