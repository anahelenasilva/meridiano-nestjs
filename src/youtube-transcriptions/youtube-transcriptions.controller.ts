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
  Req,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import {
  ApiAuthErrorResponse,
  ApiValidationErrorResponse,
} from '../shared/swagger/api-error-response.decorators';
import { AudioFilesService } from '../audio-files/audio-files.service';
import type { AuthenticatedRequest } from '../shared/types/authenticated-request';
import { parseIncludeAudio } from '../shared/helpers/parse-include-audio';
import { CreateYoutubeTranscriptionCommand } from './commands/create-youtube-transcription.command';
import { DeleteYoutubeTranscriptionCommand } from './commands/delete-youtube-transcription.command';
import { CreateYoutubeTranscriptionDto } from './dto/create-youtube-transcription.dto';
import { GetYoutubeTranscriptionByIdQuery } from './queries/get-youtube-transcription-by-id.query';
import { ListAllYoutubeTranscriptionsQuery } from './queries/list-all-youtube-transcriptions.query';

@Controller('api/youtube')
@ApiAuthErrorResponse()
export class YoutubeTranscriptionsController {
  constructor(
    private readonly listAllYoutubeTranscriptionsQuery: ListAllYoutubeTranscriptionsQuery,
    private readonly getYoutubeTranscriptionByIdQuery: GetYoutubeTranscriptionByIdQuery,
    private readonly deleteYoutubeTranscriptionCommand: DeleteYoutubeTranscriptionCommand,
    private readonly createYoutubeTranscriptionCommand: CreateYoutubeTranscriptionCommand,
    private readonly audioJobService: AudioJobService,
    private readonly audioFilesService: AudioFilesService,
  ) {}

  @Get('transcriptions')
  @ApiOperation({ summary: "List the authenticated user's YouTube transcriptions" })
  @ApiOkResponse({ description: 'List of YouTube transcriptions' })
  async listTranscriptions(@Req() request: AuthenticatedRequest) {
    return await this.listAllYoutubeTranscriptionsQuery.execute(
      request.user.id,
    );
  }

  @Post('transcriptions')
  @ApiOperation({ summary: 'Create a transcription for a YouTube video' })
  @ApiCreatedResponse({ description: 'Transcription created' })
  @ApiValidationErrorResponse()
  async createTranscription(@Body() dto: CreateYoutubeTranscriptionDto) {
    return await this.createYoutubeTranscriptionCommand.execute({
      url: dto.url,
      channelId: dto.channelId,
      customPrompt: dto.customPrompt,
      generateAudio: dto.generateAudio,
    });
  }

  @Get('transcriptions/:id')
  @ApiOperation({ summary: 'Get a YouTube transcription by id' })
  @ApiOkResponse({ description: 'Transcription retrieved' })
  @ApiNotFoundResponse({ description: 'YouTube transcription not found' })
  async getTranscription(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('includeAudio') includeAudio?: string,
  ) {
    const shouldIncludeAudio = parseIncludeAudio(includeAudio);
    const data = await this.getYoutubeTranscriptionByIdQuery.execute(
      id,
      request.user.id,
      { includeAudio: shouldIncludeAudio },
    );

    if (!data || !data.transcription) {
      throw new NotFoundException('YouTube transcription not found');
    }

    return data;
  }

  @Delete('transcriptions/:id')
  @ApiOperation({ summary: 'Delete a YouTube transcription' })
  @ApiOkResponse({ description: 'Transcription deleted' })
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.deleteYoutubeTranscriptionCommand.execute(id);
    return data;
  }

  @Post('transcriptions/:id/audio')
  @HttpCode(202)
  @ApiOperation({ summary: 'Generate audio for a YouTube transcription' })
  @ApiResponse({ status: 202, description: 'Audio generation job accepted' })
  @ApiNotFoundResponse({ description: 'YouTube transcription not found' })
  @ApiResponse({ status: 400, description: 'Transcription has no content available for audio generation' })
  @ApiResponse({ status: 409, description: 'Audio already exists or generation already in progress' })
  async generateAudio(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.getYoutubeTranscriptionByIdQuery.execute(
      id,
      request.user.id,
      { embedOwnerNote: false },
    );

    if (!data || !data.transcription) {
      throw new NotFoundException('YouTube transcription not found');
    }

    const transcription = data.transcription;
    const existingAudio = await this.audioFilesService.getAudioFileBySource(
      'transcription',
      id,
    );

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
