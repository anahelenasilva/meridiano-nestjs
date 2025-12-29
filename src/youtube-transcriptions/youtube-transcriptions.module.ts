import { Module, forwardRef } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AiService } from '../ai/ai.service';
import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';
import { DatabaseModule } from '../database/database.module';
import { QueueModule } from '../queue/queue.module';
import { CreateYoutubeTranscriptionCommand } from './commands/create-youtube-transcription.command';
import { DeleteYoutubeTranscriptionCommand } from './commands/delete-youtube-transcription.command';
import { GetYoutubeChannelsQuery } from './queries/get-youtube-channels.query';
import { GetYoutubeTranscriptionByIdQuery } from './queries/get-youtube-transcription-by-id.query';
import { ListAllYoutubeTranscriptionsQuery } from './queries/list-all-youtube-transcriptions.query';
import { ListYoutubeTranscriptionsQuery } from './queries/list-youtube-transcriptions.query';
import { StorageService } from './storage.service';
import { TranscriptService } from './transcript.service';
import { YoutubeTranscriptionsController } from './youtube-transcriptions.controller';
import { YoutubeTranscriptionsService } from './youtube-transcriptions.service';
import { YouTubeService } from './youtube.service';

@Module({
  imports: [DatabaseModule, AiModule, ConfigModule, forwardRef(() => QueueModule)],
  providers: [
    YoutubeTranscriptionsService,
    YouTubeService,
    TranscriptService,
    StorageService,
    AiService,
    ConfigService,
    ListYoutubeTranscriptionsQuery,
    ListAllYoutubeTranscriptionsQuery,
    GetYoutubeTranscriptionByIdQuery,
    DeleteYoutubeTranscriptionCommand,
    GetYoutubeChannelsQuery,
    CreateYoutubeTranscriptionCommand,
  ],
  exports: [YoutubeTranscriptionsService],
  controllers: [YoutubeTranscriptionsController],
})
export class YoutubeTranscriptionsModule { }
