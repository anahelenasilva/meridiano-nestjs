import { S3Service } from '@libs/s3';
import { Effect } from 'effect';
import { mock } from 'jest-mock-extended';
import { AiService } from '../../ai/ai.service';
import { RateLimited } from '../../ai/provider-error';
import { ConfigService } from '../../config/config.service';
import { AudioFilesService } from '../audio-files.service';
import { GenerateAudioUseCase } from './generate-audio.usecase';

describe('GenerateAudioUseCase', () => {
  const aiService = mock<AiService>();
  const s3Service = mock<S3Service>();
  const audioFilesService = mock<AudioFilesService>();
  const configService = mock<ConfigService>();
  const useCase = new GenerateAudioUseCase(
    aiService,
    s3Service,
    audioFilesService,
    configService,
  );
  const input = {
    sourceType: 'article' as const,
    sourceId: 'a-1',
    text: 'some text',
    date: new Date('2026-10-01T12:00:00Z'),
  };
  const failureOf = (program: ReturnType<GenerateAudioUseCase['execute']>) =>
    Effect.runPromise(Effect.flip(program));

  beforeEach(() => {
    jest.resetAllMocks();
    configService.getS3ArticlesBucketName.mockReturnValue('bucket');
    aiService.generateAudio.mockReturnValue(
      Effect.succeed(Buffer.from('audio')),
    );
    s3Service.uploadAudioFile.mockResolvedValue('key');
    audioFilesService.saveAudioFile.mockResolvedValue('audio-1');
  });

  it('uploads under the dated key and succeeds with the saved id', async () => {
    await expect(Effect.runPromise(useCase.execute(input))).resolves.toBe(
      'audio-1',
    );
    expect(s3Service.uploadAudioFile).toHaveBeenCalledWith(
      'bucket',
      'audio/2026-10-01/article-a-1.mp3',
      Buffer.from('audio'),
    );
  });

  it('fails with StorageNotConfigured before paying for TTS', async () => {
    configService.getS3ArticlesBucketName.mockReturnValue('');

    const error = await failureOf(useCase.execute(input));

    expect(error._tag).toBe('StorageNotConfigured');
    expect(aiService.generateAudio).not.toHaveBeenCalled();
  });

  it("passes the AI layer's typed error through and uploads nothing", async () => {
    const rateLimited = new RateLimited({ cause: new Error('429') });
    aiService.generateAudio.mockReturnValue(Effect.fail(rateLimited));

    expect(await failureOf(useCase.execute(input))).toBe(rateLimited);
    expect(s3Service.uploadAudioFile).not.toHaveBeenCalled();
  });

  it('fails with AudioUploadFailed when S3 rejects', async () => {
    const s3Error = new Error('socket hang up');
    s3Service.uploadAudioFile.mockRejectedValue(s3Error);

    const error = await failureOf(useCase.execute(input));

    expect(error).toMatchObject({ _tag: 'AudioUploadFailed', cause: s3Error });
    expect(audioFilesService.saveAudioFile).not.toHaveBeenCalled();
  });

  it('fails with AudioRecordNotSaved when the record gets no id', async () => {
    audioFilesService.saveAudioFile.mockResolvedValue(null);

    const error = await failureOf(useCase.execute(input));

    expect(error._tag).toBe('AudioRecordNotSaved');
  });
});
