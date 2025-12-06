import { Injectable } from '@nestjs/common';
import { ChannelConfig } from '../shared/types/channel';
import { VideoWithTranscript } from '../shared/types/video';
import { StorageService } from './storage.service';
import { TranscriptService } from './transcript.service';
import { YouTubeService } from './youtube.service';

@Injectable()
export class YoutubeTranscriptionsService {
  constructor(
    private readonly youtubeService: YouTubeService,
    private readonly transcriptService: TranscriptService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Extract transcripts from videos in a single channel
   * @param channel - The channel configuration
   */
  async extractChannelTranscripts(channel: ChannelConfig) {
    console.log(`\n========================================`);
    console.log(`Processing channel: ${channel.channelName}`);
    console.log(`Channel ID: ${channel.channelId}`);
    console.log(`Max videos: ${channel.maxVideos}`);
    console.log(`========================================\n`);

    try {
      // Fetch videos from the channel
      const videos = await this.youtubeService.getChannelVideos(
        channel.channelId,
        channel.maxVideos,
      );

      if (videos.length === 0) {
        console.log(`No videos found for channel: ${channel.channelName}`);
        return;
      }

      let successCount = 0;
      let failureCount = 0;

      // Process each video
      for (const video of videos) {
        try {
          console.log(`\nProcessing: ${video.title}`);

          // Get transcript
          const transcript = await this.transcriptService.getTranscript(
            video.videoId,
          );
          const transcriptText =
            this.transcriptService.transcriptToText(transcript);

          // Combine video metadata with transcript
          const videoWithTranscript: VideoWithTranscript = {
            ...video,
            transcript,
            transcriptText,
          };

          // Save to file
          await this.storageService.saveTranscript(
            channel.channelId,
            videoWithTranscript,
          );

          successCount++;
          console.log(`✓ Successfully processed video: ${video.title}`);
        } catch (error) {
          failureCount++;
          console.error(`✗ Failed to process video: ${video.title}`);
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.error(`  Error: ${errorMessage}`);
          // Continue with the next video instead of stopping
        }
      }

      console.log(`\n========================================`);
      console.log(`Channel processing complete: ${channel.channelName}`);
      console.log(`Success: ${successCount} | Failed: ${failureCount}`);
      console.log(`========================================\n`);

      // Throw error if no transcripts were successfully extracted
      if (successCount === 0) {
        throw new Error(
          `Failed to extract any transcripts from channel ${channel.channelName} (${failureCount} video(s) failed)`,
        );
      }
    } catch (error) {
      console.error(`Error processing channel ${channel.channelName}:`, error);
      throw error;
    }
  }

  /**
   * Extract transcripts from all configured channels
   * @param channels - Array of channel configurations
   */
  async extractAll(channels: ChannelConfig[]) {
    console.log(
      `\n🚀 Starting transcript extraction for ${channels.length} channel(s)...\n`,
    );

    const startTime = Date.now();
    let totalSuccess = 0;
    let totalFailure = 0;

    for (const channel of channels) {
      try {
        await this.extractChannelTranscripts(channel);
        totalSuccess++;
      } catch (error) {
        totalFailure++;
        console.error(
          `Total failed: ${totalFailure} to process channel: ${channel.channelName}`,
          error,
        );
        // Continue with the next channel
      }
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log(`\n========================================`);
    console.log(`🎉 Extraction complete!`);
    console.log(`Total channels processed: ${totalSuccess}/${channels.length}`);
    console.log(`Total time: ${duration}s`);
    console.log(`========================================\n`);
  }
}
