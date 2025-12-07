import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import type { PaginatedYoutubeTranscriptionInput } from './entities/youtube-transcription.entity';
import { GetYoutubeTranscriptionByIdQuery } from './queries/get-youtube-transcription-by-id.query';
import { ListYoutubeTranscriptionsQuery } from './queries/list-youtube-transcriptions.query';

@Controller('api/youtube/transcriptions')
export class YoutubeTranscriptionsController {
  constructor(
    private readonly listYoutubeTranscriptionsQuery: ListYoutubeTranscriptionsQuery,
    private readonly getYoutubeTranscriptionByIdQuery: GetYoutubeTranscriptionByIdQuery,
  ) { }

  @Get()
  async listTranscriptions(@Query() input: PaginatedYoutubeTranscriptionInput) {
    return await this.listYoutubeTranscriptionsQuery.execute(input);
  }

  @Get(':id')
  async getTranscription(@Param('id', ParseIntPipe) id: number) {
    const data = await this.getYoutubeTranscriptionByIdQuery.execute(id);

    if (!data || !data.transcription) {
      throw new NotFoundException('YouTube transcription not found');
    }

    return data;
  }
}
