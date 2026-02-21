import { DatabaseModule } from '@libs/database';
import { S3Module } from '@libs/s3';
import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ConfigModule } from '../config/config.module';
import { AudioFilesService } from './audio-files.service';
import { GenerateAudioUseCase } from './usecases/generate-audio.usecase';

@Module({
  imports: [DatabaseModule, S3Module, AiModule, ConfigModule],
  providers: [AudioFilesService, GenerateAudioUseCase],
  exports: [AudioFilesService, GenerateAudioUseCase],
})
export class AudioFilesModule {}
