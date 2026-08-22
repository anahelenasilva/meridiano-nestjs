import { AudioJobService } from '@libs/audio';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { ApiAuthErrorResponse } from '../shared/swagger/api-error-response.decorators';
import { ListAudioLibraryQuery } from './queries/list-audio-library.query';
// Type-only under isolatedModules + emitDecoratorMetadata: a decorated @Query()
// signature type must not be a runtime import (nest build / generate:openapi).
import type { ListAudioLibraryRequest } from './queries/list-audio-library.query';

@Controller('api/audio')
@ApiAuthErrorResponse()
export class AudioController {
  constructor(
    private readonly listAudioLibraryQuery: ListAudioLibraryQuery,
    private readonly audioJobService: AudioJobService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'List generated audio from Articles and YouTube Transcriptions in one place',
  })
  @ApiOkResponse({ description: 'Paginated list of generated audio' })
  async listAudio(@Query() input: ListAudioLibraryRequest) {
    return await this.listAudioLibraryQuery.execute(input);
  }

  // Declared before any future @Get(':id') so 'jobs' is never captured as a
  // route param.
  @Get('jobs')
  @ApiOperation({
    summary:
      'List in-flight and recently-failed audio generation jobs, keyed by source',
  })
  @ApiOkResponse({ description: 'Queued, generating, and failed audio jobs' })
  async listJobs() {
    return { jobs: await this.audioJobService.listActiveAndFailedJobs() };
  }
}
