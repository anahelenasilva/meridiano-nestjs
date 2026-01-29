import { DatabaseModule } from '@libs/database';
import { QueueModule } from '@libs/queue';
import { RedisModule } from '@libs/redis';
import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AiService } from '../ai/ai.service';
import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';
import { YoutubeChannelsModule } from '../youtube-channels/youtube-channels.module';
import { CreateYoutubeTranscriptionCommand } from './commands/create-youtube-transcription.command';
import { DeleteYoutubeTranscriptionCommand } from './commands/delete-youtube-transcription.command';
import { YoutubeTranscriptionProcessor } from './processors/youtube-transcription.processor';
import { GetYoutubeTranscriptionByIdQuery } from './queries/get-youtube-transcription-by-id.query';
import { ListAllYoutubeTranscriptionsQuery } from './queries/list-all-youtube-transcriptions.query';
import { ListYoutubeTranscriptionsQuery } from './queries/list-youtube-transcriptions.query';
import { StorageService } from './services/storage.service';
import { TranscriptService } from './services/transcript.service';
import { YoutubeTranscriptionsAlternativeService } from './services/youtube-transcriptions-alternative.service';
import { YoutubeTranscriptionsService } from './services/youtube-transcriptions.service';
import { YouTubeService } from './services/youtube.service';
import { YoutubeTranscriptionsController } from './youtube-transcriptions.controller';

@Module({
  imports: [
    DatabaseModule,
    AiModule,
    ConfigModule,
    YoutubeChannelsModule,
    RedisModule,
    QueueModule,
  ],
  providers: [
    YoutubeTranscriptionsService,
    YouTubeService,
    TranscriptService,
    YoutubeTranscriptionsAlternativeService,
    StorageService,
    AiService,
    ConfigService,
    ListYoutubeTranscriptionsQuery,
    ListAllYoutubeTranscriptionsQuery,
    GetYoutubeTranscriptionByIdQuery,
    DeleteYoutubeTranscriptionCommand,
    CreateYoutubeTranscriptionCommand,
    YoutubeTranscriptionProcessor,
  ],
  exports: [YoutubeTranscriptionsService],
  controllers: [YoutubeTranscriptionsController],
})
export class YoutubeTranscriptionsModule { }
