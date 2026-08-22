import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { ApiAuthErrorResponse } from '../shared/swagger/api-error-response.decorators';
import {
  ListAudioLibraryQuery,
  ListAudioLibraryRequest,
} from './queries/list-audio-library.query';

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
