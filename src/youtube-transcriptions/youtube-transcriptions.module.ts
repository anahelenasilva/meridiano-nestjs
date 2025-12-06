import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { TranscriptService } from './transcript.service';
import { YoutubeTranscriptionsService } from './youtube-transcriptions.service';
import { YouTubeService } from './youtube.service';

@Module({
  providers: [
    YoutubeTranscriptionsService,
    YouTubeService,
    TranscriptService,
    StorageService,
  ],
})
export class YoutubeTranscriptionsModule {}
