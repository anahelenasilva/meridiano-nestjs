import { Test, TestingModule } from '@nestjs/testing';

import { CreateYoutubeTranscriptionCommand } from './commands/create-youtube-transcription.command';
import { DeleteYoutubeTranscriptionCommand } from './commands/delete-youtube-transcription.command';
import { GetYoutubeTranscriptionByIdQuery } from './queries/get-youtube-transcription-by-id.query';
import { ListAllYoutubeTranscriptionsQuery } from './queries/list-all-youtube-transcriptions.query';
import { YoutubeTranscriptionsController } from './youtube-transcriptions.controller';

describe.skip('YoutubeTranscriptionsController', () => {
  let controller: YoutubeTranscriptionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [YoutubeTranscriptionsController],
      providers: [
        ListAllYoutubeTranscriptionsQuery,
        GetYoutubeTranscriptionByIdQuery,
        DeleteYoutubeTranscriptionCommand,
        CreateYoutubeTranscriptionCommand,
      ],
    }).compile();

    controller = module.get<YoutubeTranscriptionsController>(
      YoutubeTranscriptionsController,
    );
  });

  it.skip('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
