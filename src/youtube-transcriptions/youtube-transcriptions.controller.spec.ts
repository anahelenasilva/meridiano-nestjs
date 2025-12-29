import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { CreateYoutubeTranscriptionCommand } from './commands/create-youtube-transcription.command';
import { DeleteYoutubeTranscriptionCommand } from './commands/delete-youtube-transcription.command';
import { GetYoutubeChannelsQuery } from './queries/get-youtube-channels.query';
import { GetYoutubeTranscriptionByIdQuery } from './queries/get-youtube-transcription-by-id.query';
import { ListAllYoutubeTranscriptionsQuery } from './queries/list-all-youtube-transcriptions.query';
import { YoutubeTranscriptionsController } from './youtube-transcriptions.controller';

describe('YoutubeTranscriptionsController', () => {
  let controller: YoutubeTranscriptionsController;

  const mockListAllYoutubeTranscriptionsQuery = mock<ListAllYoutubeTranscriptionsQuery>();
  const mockGetYoutubeTranscriptionByIdQuery = mock<GetYoutubeTranscriptionByIdQuery>();
  const mockDeleteYoutubeTranscriptionCommand = mock<DeleteYoutubeTranscriptionCommand>();
  const mockGetYoutubeChannelsQuery = mock<GetYoutubeChannelsQuery>();
  const mockCreateYoutubeTranscriptionCommand = mock<CreateYoutubeTranscriptionCommand>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [YoutubeTranscriptionsController],
      providers: [
        {
          provide: ListAllYoutubeTranscriptionsQuery,
          useValue: mockListAllYoutubeTranscriptionsQuery,
        },
        {
          provide: GetYoutubeTranscriptionByIdQuery,
          useValue: mockGetYoutubeTranscriptionByIdQuery,
        },
        {
          provide: DeleteYoutubeTranscriptionCommand,
          useValue: mockDeleteYoutubeTranscriptionCommand,
        },
        {
          provide: GetYoutubeChannelsQuery,
          useValue: mockGetYoutubeChannelsQuery,
        },
        {
          provide: CreateYoutubeTranscriptionCommand,
          useValue: mockCreateYoutubeTranscriptionCommand,
        },
      ],
    }).compile();

    controller = module.get<YoutubeTranscriptionsController>(
      YoutubeTranscriptionsController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
