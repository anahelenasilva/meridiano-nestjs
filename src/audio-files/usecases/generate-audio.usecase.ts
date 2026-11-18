import { S3Service } from '@libs/s3';
import { Injectable, Logger } from '@nestjs/common';
import { Data, Effect } from 'effect';
import { AiService } from '../../ai/ai.service';
import { AudioFilesService } from '../../audio-files/audio-files.service';
import { ConfigService } from '../../config/config.service';
import { GenerateAudioInputDto } from './dto/generate-audio.dto';

export class StorageNotConfigured extends Data.TaggedError(
  'StorageNotConfigured',
)<{
  readonly message: string;
}> {}

export class AudioUploadFailed extends Data.TaggedError('AudioUploadFailed')<{
  readonly cause: unknown;
}> {}

export class AudioRecordNotSaved extends Data.TaggedError(
  'AudioRecordNotSaved',
)<{
  readonly cause: unknown;
}> {}

export type GenerateAudioError = Effect.Effect.Error<
  ReturnType<GenerateAudioUseCase['execute']>
>;

@Injectable()
export class GenerateAudioUseCase {
  private readonly logger = new Logger(GenerateAudioUseCase.name);

  constructor(
    private readonly aiService: AiService,
    private readonly s3Service: S3Service,
    private readonly audioFilesService: AudioFilesService,
    private readonly configService: ConfigService,
  ) {}

  /** Succeeds with the saved audio file's id. */
  execute(input: GenerateAudioInputDto) {
    return Effect.gen(this, function* () {
      // Checked before TTS so a missing bucket does not pay for audio first.
      const s3Bucket = this.configService.getS3ArticlesBucketName();
      if (!s3Bucket) {
        return yield* new StorageNotConfigured({
          message: 'S3_ARTICLES_BUCKET_NAME environment variable not set',
        });
      }

      this.logger.log(
        `Generating audio for ${input.sourceType} ${input.sourceId}`,
      );
      const audioBuffer = yield* this.aiService.generateAudio(input.text);

      const dateStr = input.date.toISOString().split('T')[0];
      const s3Key = `audio/${dateStr}/${input.sourceType}-${input.sourceId}.mp3`;

      this.logger.log(`Uploading audio to S3: ${s3Bucket}/${s3Key}`);
      yield* Effect.tryPromise({
        try: () => this.s3Service.uploadAudioFile(s3Bucket, s3Key, audioBuffer),
        catch: (cause) => new AudioUploadFailed({ cause }),
      });

      const audioFileId = yield* Effect.tryPromise({
        try: () =>
          this.audioFilesService.saveAudioFile(
            input.sourceType,
            input.sourceId,
            s3Bucket,
            s3Key,
            audioBuffer.length,
          ),
        catch: (cause) => new AudioRecordNotSaved({ cause }),
      });
      if (!audioFileId) {
        return yield* new AudioRecordNotSaved({
          cause: 'saveAudioFile returned no id',
        });
      }

      this.logger.log(
        `Audio generation complete for ${input.sourceType} ${input.sourceId}: ${audioFileId}`,
      );
      return audioFileId;
    });
  }
}
