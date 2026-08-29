import { ApiKeyAllowed } from '@libs/auth';
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
import { DeleteYoutubeTranscriptionCommand } from './commands/delete-youtube-transcription.command';
import { DismissIngestJobCommand } from './commands/dismiss-ingest-job.command';
import { EnqueueYoutubeTranscriptionsCommand } from './commands/enqueue-youtube-transcriptions.command';
import { CreateYoutubeTranscriptionDto } from './dto/create-youtube-transcription.dto';
import { GetYoutubeTranscriptionByIdQuery } from './queries/get-youtube-transcription-by-id.query';
import { ListAllYoutubeTranscriptionsQuery } from './queries/list-all-youtube-transcriptions.query';
import { ListFailedIngestJobsQuery } from './queries/list-failed-ingest-jobs.query';

@Controller('api/youtube')
@ApiAuthErrorResponse()
export class YoutubeTranscriptionsController {
  constructor(
    private readonly listAllYoutubeTranscriptionsQuery: ListAllYoutubeTranscriptionsQuery,
    private readonly getYoutubeTranscriptionByIdQuery: GetYoutubeTranscriptionByIdQuery,
    private readonly deleteYoutubeTranscriptionCommand: DeleteYoutubeTranscriptionCommand,
    private readonly enqueueYoutubeTranscriptionsCommand: EnqueueYoutubeTranscriptionsCommand,
    private readonly listFailedIngestJobsQuery: ListFailedIngestJobsQuery,
    private readonly dismissIngestJobCommand: DismissIngestJobCommand,
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
  @ApiKeyAllowed()
  @HttpCode(202)
  @ApiOperation({
    summary: 'Queue one or more YouTube videos for transcription',
  })
  @ApiResponse({
    status: 202,
    description: 'Videos queued, with the skipped and rejected URLs reported',
  })
  @ApiValidationErrorResponse()
  async createTranscription(@Body() dto: CreateYoutubeTranscriptionDto) {
    return await this.enqueueYoutubeTranscriptionsCommand.execute({
      urls: dto.urls,
      channelDbId: dto.channelId,
      customPrompt: dto.customPrompt,
      generateAudio: dto.generateAudio,
    });
  }

  // Declared before transcriptions/:id so 'jobs' is not read as an id.
  @Get('transcriptions/jobs/failed')
  @ApiOperation({
    summary: 'List failed YouTube transcript ingest jobs',
  })
  @ApiOkResponse({ description: 'Failed ingest jobs' })
  async listFailedIngestJobs() {
    return { jobs: await this.listFailedIngestJobsQuery.execute() };
  }

  // Declared before transcriptions/:id so a channel:video job id is not
  // rejected by that route's ParseUUIDPipe.
  @Delete('transcriptions/jobs/:jobId')
  @ApiOperation({ summary: 'Dismiss a failed ingest job' })
  @ApiOkResponse({ description: 'Ingest job dismissed' })
  @ApiNotFoundResponse({ description: 'Ingest job not found' })
  async dismissIngestJob(@Param('jobId') jobId: string) {
    return await this.dismissIngestJobCommand.execute(jobId);
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
