import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post
} from '@nestjs/common';
import { CreateYoutubeTranscriptionCommand } from './commands/create-youtube-transcription.command';
import { DeleteYoutubeTranscriptionCommand } from './commands/delete-youtube-transcription.command';
import { CreateYoutubeTranscriptionDto } from './dto/create-youtube-transcription.dto';
import { GetYoutubeChannelsQuery } from './queries/get-youtube-channels.query';
import { GetYoutubeTranscriptionByIdQuery } from './queries/get-youtube-transcription-by-id.query';
import { ListAllYoutubeTranscriptionsQuery } from './queries/list-all-youtube-transcriptions.query';

@Controller('api/youtube')
export class YoutubeTranscriptionsController {
  constructor(
    private readonly listAllYoutubeTranscriptionsQuery: ListAllYoutubeTranscriptionsQuery,
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
