import { AUDIO_GENERATION_SUCCESS_MESSAGE, AudioJobService } from '@libs/audio';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { AudioFilesService } from '../audio-files/audio-files.service';
import { parseIncludeAudio } from '../shared/helpers/parse-include-audio';
import { CreateYoutubeTranscriptionCommand } from './commands/create-youtube-transcription.command';
import { DeleteYoutubeTranscriptionCommand } from './commands/delete-youtube-transcription.command';
import { CreateYoutubeTranscriptionDto } from './dto/create-youtube-transcription.dto';
import { GetYoutubeTranscriptionByIdQuery } from './queries/get-youtube-transcription-by-id.query';
import { ListAllYoutubeTranscriptionsQuery } from './queries/list-all-youtube-transcriptions.query';

@Controller('api/youtube')
export class YoutubeTranscriptionsController {
  constructor(
    private readonly listAllYoutubeTranscriptionsQuery: ListAllYoutubeTranscriptionsQuery,
    private readonly getYoutubeTranscriptionByIdQuery: GetYoutubeTranscriptionByIdQuery,
    private readonly deleteYoutubeTranscriptionCommand: DeleteYoutubeTranscriptionCommand,
    private readonly createYoutubeTranscriptionCommand: CreateYoutubeTranscriptionCommand,
    private readonly audioJobService: AudioJobService,
    private readonly audioFilesService: AudioFilesService,
  ) { }

  @Get('transcriptions')
  async listTranscriptions() {
    return await this.listAllYoutubeTranscriptionsQuery.execute();
  }

  @Post('transcriptions')
  async createTranscription(@Body() dto: CreateYoutubeTranscriptionDto) {
    return await this.createYoutubeTranscriptionCommand.execute({
      url: dto.url,
      channelId: dto.channelId,
    });
  }

  @Get('transcriptions/:id')
  async getTranscription(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('includeAudio') includeAudio?: string,
  ) {
    const shouldIncludeAudio = parseIncludeAudio(includeAudio);
    const data = await this.getYoutubeTranscriptionByIdQuery.execute(
      id,
      shouldIncludeAudio,
    );

    if (!data || !data.transcription) {
      throw new NotFoundException('YouTube transcription not found');
    }

    return data;
  }

  @Delete('transcriptions/:id')
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.deleteYoutubeTranscriptionCommand.execute(id);
    return data;
  }

  @Post('transcriptions/:id/audio')
  @HttpCode(202)
  async generateAudio(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.getYoutubeTranscriptionByIdQuery.execute(id);

    if (!data || !data.transcription) {
      throw new NotFoundException('YouTube transcription not found');
    }

    const transcription = data.transcription;
    const existingAudio = await this.audioFilesService.getAudioFileBySource(
      'transcription',
      id,
    );

    console.log('existingAudio', {
      existingAudio,
      id
    });

    if (existingAudio) {
      throw new ConflictException(
        'Audio already exists for this resource. Use the detail endpoint with includeAudio=true to fetch the audio.',
      );
    }

    const text =
      transcription.transcriptionSummary || transcription.transcriptionText;

    if (!text || text.trim().length === 0) {
      throw new BadRequestException(
        'Transcription has no content available for audio generation',
      );
    }

    const jobInfo = await this.audioJobService.enqueueAudioJobIfNotDuplicate({
      sourceType: 'transcription',
      sourceId: id,
      text,
      date: transcription.postedAt ? transcription.postedAt : new Date(),
    });

    if (!jobInfo) {
      throw new ConflictException(
        'Audio generation is already in progress for this resource.',
      );
    }

    return {
      jobId: jobInfo.jobId,
      message: AUDIO_GENERATION_SUCCESS_MESSAGE,
    };
  }

  // @Public()
  // @Get('transcriptions/:id/audio')
  // async downloadAudio(@Param('id') id: string) {
  //   const audio = await this.youtubeService.downloadAudioFromVideo(id);
  //   return audio;
  // }
}
