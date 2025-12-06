import { Injectable } from '@nestjs/common';
import { Innertube } from 'youtubei.js';
import { TranscriptItem } from '../shared/types/video';

@Injectable()
export class TranscriptService {
  private youtube: Innertube | null = null;

  constructor() {}

  /**
   * Initialize the YouTube client
   */
  private async initialize() {
    if (!this.youtube) {
      this.youtube = await Innertube.create();
    }
  }

  /**
   * Get transcript for a YouTube video
   * @param videoId - The YouTube video ID
   * @returns Array of transcript items
   */
  async getTranscript(videoId: string) {
    try {
      console.log(`Fetching transcript for video: ${videoId}`);

      await this.initialize();

      if (!this.youtube) {
        throw new Error('Failed to initialize YouTube client');
      }

      // Get video info which includes transcript data
      const info = await this.youtube.getInfo(videoId);

      // Get the transcript
      const transcriptData = await info.getTranscript();

      if (
        !transcriptData ||
        !transcriptData.transcript ||
        !transcriptData.transcript.content ||
        !transcriptData.transcript.content.body
      ) {
        console.log(`No transcript available for video ${videoId}`);
        return [];
      }

      const transcriptItems: TranscriptItem[] =
        transcriptData.transcript.content.body.initial_segments.map(
          (segment: any) => ({
            text: segment.snippet.text,
            duration: segment.end_ms - segment.start_ms,
            offset: segment.start_ms,
          }),
        );

      console.log(
        `Successfully fetched transcript for video ${videoId} (${transcriptItems.length} items)`,
      );
      return transcriptItems;
    } catch (error) {
      console.error(`Error fetching transcript for video ${videoId}:`, error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to fetch transcript for video ${videoId}: ${errorMessage}`,
      );
    }
  }

  /**
   * Convert transcript items to a single text string
   * @param transcriptItems - Array of transcript items
   * @returns Full transcript as a single string
   */
  transcriptToText(transcriptItems: TranscriptItem[]): string {
    return transcriptItems.map((item) => item.text).join(' ');
  }
}
