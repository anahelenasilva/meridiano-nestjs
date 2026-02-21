import { mock } from 'jest-mock-extended';
import { CreateYoutubeTranscriptionCommand } from './commands/create-youtube-transcription.command';
import { DeleteYoutubeTranscriptionCommand } from './commands/delete-youtube-transcription.command';
import { GetYoutubeTranscriptionByIdQuery } from './queries/get-youtube-transcription-by-id.query';
import { ListAllYoutubeTranscriptionsQuery } from './queries/list-all-youtube-transcriptions.query';
import { YoutubeTranscriptionsService } from './services/youtube-transcriptions.service';
import { YoutubeTranscriptionsController } from './youtube-transcriptions.controller';

describe('YoutubeTranscriptionsController', () => {
  let controller: YoutubeTranscriptionsController;
  const mockYoutubeTranscriptionsService = mock<YoutubeTranscriptionsService>();

  beforeEach(() => {
    const mockListAllYoutubeTranscriptionsQuery =
      new ListAllYoutubeTranscriptionsQuery(mockYoutubeTranscriptionsService);
    const mockGetYoutubeTranscriptionByIdQuery =
      new GetYoutubeTranscriptionByIdQuery(mockYoutubeTranscriptionsService);
    const mockDeleteYoutubeTranscriptionCommand =
      new DeleteYoutubeTranscriptionCommand(mockYoutubeTranscriptionsService);
    const mockCreateYoutubeTranscriptionCommand =
      new CreateYoutubeTranscriptionCommand(mockYoutubeTranscriptionsService);

    controller = new YoutubeTranscriptionsController(
      mockListAllYoutubeTranscriptionsQuery,
      mockGetYoutubeTranscriptionByIdQuery,
      mockDeleteYoutubeTranscriptionCommand,
      mockCreateYoutubeTranscriptionCommand,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
