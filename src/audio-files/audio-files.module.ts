import { DatabaseModule } from '@libs/database';
import { QueueModule } from '@libs/queue';
import { RedisModule } from '@libs/redis';
import { S3Module } from '@libs/s3';
import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ConfigModule } from '../config/config.module';
import { AudioFilesService } from './audio-files.service';
import { AudioGenerationProcessor } from './processors/audio-generation.processor';
import { GenerateAudioUseCase } from './usecases/generate-audio.usecase';

@Module({
  imports: [DatabaseModule, S3Module, AiModule, ConfigModule, RedisModule, QueueModule],
  providers: [AudioFilesService, GenerateAudioUseCase, AudioGenerationProcessor],
  exports: [AudioFilesService, GenerateAudioUseCase],
})
export class AudioFilesModule {}
