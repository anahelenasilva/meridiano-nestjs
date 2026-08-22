import { AudioModule } from '@libs/audio';
import { DatabaseModule } from '@libs/database';
import { QueueModule } from '@libs/queue';
import { S3Module } from '@libs/s3';
import { AudioFilesModule } from '../audio-files/audio-files.module';
import { RedisModule } from '@libs/redis';
import { Module, forwardRef } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AiService } from '../ai/ai.service';
import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';
import { NotesCleanupModule } from '../notes/notes-cleanup.module';
import { NotesReadModule } from '../notes/notes-read.module';
import { YoutubeChannelsModule } from '../youtube-channels/youtube-channels.module';
import { CreateYoutubeTranscriptionCommand } from './commands/create-youtube-transcription.command';
import { DeleteYoutubeTranscriptionCommand } from './commands/delete-youtube-transcription.command';
import { TranscriptBackupProcessor } from './processors/transcript-backup.processor';
import { YoutubeTranscriptionProcessor } from './processors/youtube-transcription.processor';
import { GetYoutubeTranscriptionByIdQuery } from './queries/get-youtube-transcription-by-id.query';
import { ListAllYoutubeTranscriptionsQuery } from './queries/list-all-youtube-transcriptions.query';
import { StorageService } from './services/storage.service';
import { TranscriptChunkingService } from './services/transcript-chunking.service';
import { TranscriptService } from './services/transcript.service';
import { YoutubeTranscriptionsAlternativeService } from './services/youtube-transcriptions-alternative.service';
import { YoutubeTranscriptionsService } from './services/youtube-transcriptions.service';
import { YouTubeService } from './services/youtube.service';
import { YoutubeTranscriptionsController } from './youtube-transcriptions.controller';

// Usecases
import { ExtractYoutubeTranscriptsUseCase } from './usecases/extract-youtube-transcripts.usecase';
import { ListTranscriptionsUseCase } from './usecases/list-transcriptions.usecase';
import { ProcessTranscriptionFilesUseCase } from './usecases/process-transcription-files.usecase';

@Module({
  imports: [
    DatabaseModule,
    AudioFilesModule,
    S3Module,
    AiModule,
    ConfigModule,
    YoutubeChannelsModule,
    RedisModule,
    forwardRef(() => QueueModule),
    AudioModule,
    NotesCleanupModule,
    NotesReadModule,
  ],
  providers: [
    YoutubeTranscriptionsService,
    YouTubeService,
    TranscriptService,
    YoutubeTranscriptionsAlternativeService,
    StorageService,
    AiService,
    ConfigService,
    TranscriptChunkingService,
    ListAllYoutubeTranscriptionsQuery,
    GetYoutubeTranscriptionByIdQuery,
    DeleteYoutubeTranscriptionCommand,
    CreateYoutubeTranscriptionCommand,
    YoutubeTranscriptionProcessor,
    TranscriptBackupProcessor,
    // YouTube transcription usecases
    ExtractYoutubeTranscriptsUseCase,
    ListTranscriptionsUseCase,
    ProcessTranscriptionFilesUseCase,
  ],
  exports: [
    YoutubeTranscriptionsService,
    // Export usecases for external use
    ExtractYoutubeTranscriptsUseCase,
    ListTranscriptionsUseCase,
    ProcessTranscriptionFilesUseCase,
  ],
  controllers: [YoutubeTranscriptionsController],
})
export class YoutubeTranscriptionsModule {}
