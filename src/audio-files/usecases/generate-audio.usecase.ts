import { S3Service } from '@libs/s3';
import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../../ai/ai.service';
import { AudioFilesService } from '../../audio-files/audio-files.service';
import { ConfigService } from '../../config/config.service';
import {
  GenerateAudioInputDto,
  GenerateAudioOutputDto,
} from './dto/generate-audio.dto';

@Injectable()
export class GenerateAudioUseCase {
  private readonly logger = new Logger(GenerateAudioUseCase.name);

  constructor(
    private readonly aiService: AiService,
    private readonly s3Service: S3Service,
    private readonly audioFilesService: AudioFilesService,
    private readonly configService: ConfigService,
  ) {}

  async execute(input: GenerateAudioInputDto): Promise<GenerateAudioOutputDto> {
    try {
      // Generate audio using AI service
      this.logger.log(
        `Generating audio for ${input.sourceType} ${input.sourceId}`,
      );
      const audioBuffer = await this.aiService.generateAudio(input.text);

      const dateStr = input.date.toISOString().split('T')[0];
      const s3Key = `audio/${dateStr}/${input.sourceType}-${input.sourceId}.mp3`;

      const s3Bucket = process.env.S3_ARTICLES_BUCKET_NAME;
      if (!s3Bucket) {
        return {
          success: false,
          error: 'S3_ARTICLES_BUCKET_NAME environment variable not set',
        };
      }

      // Upload to S3
      this.logger.log(`Uploading audio to S3: ${s3Bucket}/${s3Key}`);
      await this.s3Service.uploadAudioFile(s3Bucket, s3Key, audioBuffer);

      // Save record to database
      const fileSizeBytes = audioBuffer.length;
      const audioFileId = await this.audioFilesService.saveAudioFile(
        input.sourceType,
        input.sourceId,
        s3Bucket,
        s3Key,
        fileSizeBytes,
      );

      if (!audioFileId) {
        return {
          success: false,
          error: 'Failed to save audio file record to database',
        };
      }

      this.logger.log(
        `Audio generation complete for ${input.sourceType} ${input.sourceId}: ${audioFileId}`,
      );

      return {
        success: true,
        audioFileId,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Error generating audio for ${input.sourceType} ${input.sourceId}: ${errorMessage}`,
      );

      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}
