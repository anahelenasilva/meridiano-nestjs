import { Test, TestingModule } from '@nestjs/testing';
import { GetYoutubeTranscriptionByIdQuery } from './queries/get-youtube-transcription-by-id.query';
import { ListYoutubeTranscriptionsQuery } from './queries/list-youtube-transcriptions.query';
import { YoutubeTranscriptionsController } from './youtube-transcriptions.controller';

describe('YoutubeTranscriptionsController', () => {
  let controller: YoutubeTranscriptionsController;

  const mockListYoutubeTranscriptionsQuery = {
    execute: jest.fn(),
  };

  const mockGetYoutubeTranscriptionByIdQuery = {
    execute: jest.fn(),
  };

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
