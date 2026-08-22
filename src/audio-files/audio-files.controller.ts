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
  constructor(private readonly listAudioLibraryQuery: ListAudioLibraryQuery) {}

  @Get()
  @ApiOperation({
    summary:
      'List generated audio from Articles and YouTube Transcriptions in one place',
  })
  @ApiOkResponse({ description: 'Paginated list of generated audio' })
  async listAudio(@Query() input: ListAudioLibraryRequest) {
    return await this.listAudioLibraryQuery.execute(input);
  }
}
