import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AiService } from '../ai/ai.service';
import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';
import { DatabaseModule } from '../database/database.module';
import { StorageService } from './storage.service';
import { TranscriptService } from './transcript.service';
import { YoutubeTranscriptionsService } from './youtube-transcriptions.service';
import { YouTubeService } from './youtube.service';

@Module({
  imports: [DatabaseModule, AiModule, ConfigModule],
  providers: [
    YoutubeTranscriptionsService,
    YouTubeService,
    TranscriptService,
    StorageService,
    AiService,
    ConfigService,
  ],
  exports: [YoutubeTranscriptionsService],
})
export class YoutubeTranscriptionsModule {}
