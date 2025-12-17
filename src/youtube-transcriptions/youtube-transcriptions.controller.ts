import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CreateYoutubeTranscriptionCommand } from './commands/create-youtube-transcription.command';
import { DeleteYoutubeTranscriptionCommand } from './commands/delete-youtube-transcription.command';
import { CreateYoutubeTranscriptionDto } from './dto/create-youtube-transcription.dto';
import type { PaginatedYoutubeTranscriptionInput } from './entities/youtube-transcription.entity';
import { GetYoutubeChannelsQuery } from './queries/get-youtube-channels.query';
import { GetYoutubeTranscriptionByIdQuery } from './queries/get-youtube-transcription-by-id.query';
import { ListYoutubeTranscriptionsQuery } from './queries/list-youtube-transcriptions.query';

@Controller('api/youtube')
export class YoutubeTranscriptionsController {
  constructor(
    private readonly listYoutubeTranscriptionsQuery: ListYoutubeTranscriptionsQuery,
    private readonly getYoutubeTranscriptionByIdQuery: GetYoutubeTranscriptionByIdQuery,
    private readonly deleteYoutubeTranscriptionCommand: DeleteYoutubeTranscriptionCommand,
    private readonly getYoutubeChannelsQuery: GetYoutubeChannelsQuery,
    private readonly createYoutubeTranscriptionCommand: CreateYoutubeTranscriptionCommand
  ) { }

  @Get('channels')
  async getChannels() {
    return await this.getYoutubeChannelsQuery.execute();
  }

  @Get('transcriptions')
  async listTranscriptions(@Query() input: PaginatedYoutubeTranscriptionInput) {
    return await this.listYoutubeTranscriptionsQuery.execute(input);
  }

  @Post('transcriptions')
  async createTranscription(@Body() dto: CreateYoutubeTranscriptionDto) {
    return await this.createYoutubeTranscriptionCommand.execute({
      url: dto.url,
      channelId: dto.channelId,
    });
  }

  @Get('transcriptions/:id')
  async getTranscription(@Param('id', ParseIntPipe) id: number) {
    const data = await this.getYoutubeTranscriptionByIdQuery.execute(id);

    if (!data || !data.transcription) {
      throw new NotFoundException('YouTube transcription not found');
    }

    return data;
  }

  @Delete('transcriptions/:id')
  async delete(@Param('id', ParseIntPipe) id: number) {
    const data = await this.deleteYoutubeTranscriptionCommand.execute(id);
    return data;
  }
}
