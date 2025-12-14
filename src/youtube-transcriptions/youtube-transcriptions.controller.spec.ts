import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { DeleteYoutubeTranscriptionCommand } from './commands/delete-youtube-transcription.command';
import { GetYoutubeTranscriptionByIdQuery } from './queries/get-youtube-transcription-by-id.query';
import { ListYoutubeTranscriptionsQuery } from './queries/list-youtube-transcriptions.query';
import { YoutubeTranscriptionsController } from './youtube-transcriptions.controller';

describe('YoutubeTranscriptionsController', () => {
  let controller: YoutubeTranscriptionsController;

  const mockListYoutubeTranscriptionsQuery = mock<ListYoutubeTranscriptionsQuery>();
  const mockGetYoutubeTranscriptionByIdQuery = mock<GetYoutubeTranscriptionByIdQuery>();
  const mockDeleteYoutubeTranscriptionCommand = mock<DeleteYoutubeTranscriptionCommand>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [YoutubeTranscriptionsController],
      providers: [
        {
          provide: ListYoutubeTranscriptionsQuery,
          useValue: mockListYoutubeTranscriptionsQuery,
        },
        {
          provide: GetYoutubeTranscriptionByIdQuery,
          useValue: mockGetYoutubeTranscriptionByIdQuery,
        },
        {
          provide: DeleteYoutubeTranscriptionCommand,
          useValue: mockDeleteYoutubeTranscriptionCommand,
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
