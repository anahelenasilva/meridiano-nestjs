import { AudioModule } from '@libs/audio';
import { DatabaseModule } from '@libs/database';
import { QueueModule } from '@libs/queue';
import { RedisModule } from '@libs/redis';
import { S3Module } from '@libs/s3';
import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ConfigModule } from '../config/config.module';
import { AudioFilesCleanupService } from './audio-files-cleanup.service';
import { AudioController } from './audio-files.controller';
import { AudioFilesService } from './audio-files.service';
import { AudioGenerationProcessor } from './processors/audio-generation.processor';
import { ListAudioLibraryQuery } from './queries/list-audio-library.query';
import { GenerateAudioUseCase } from './usecases/generate-audio.usecase';

@Module({
  // AudioModule provides AudioJobService (queue job status/listing), matching how
  // other feature modules (articles, youtube-transcriptions, processor, scraper)
  // consume @libs/audio: import the module rather than re-registering the provider.
  imports: [DatabaseModule, S3Module, AiModule, ConfigModule, RedisModule, QueueModule, AudioModule],
  controllers: [AudioController],
  providers: [
    AudioFilesService,
    AudioFilesCleanupService,
    GenerateAudioUseCase,
    AudioGenerationProcessor,
    ListAudioLibraryQuery,
  ],
  exports: [AudioFilesService, AudioFilesCleanupService, GenerateAudioUseCase],
})
export class AudioFilesModule {}
