import { Injectable } from '@nestjs/common';
import { YoutubeTranscriptionsService } from '../services/youtube-transcriptions.service';

export type DeleteYoutubeTranscriptionCommandResponse = {
  sucess: boolean;
  error?: string;
};

@Injectable()
export class DeleteYoutubeTranscriptionCommand {
  constructor(private readonly service: YoutubeTranscriptionsService) { }

  async execute(
    id: string,
  ): Promise<DeleteYoutubeTranscriptionCommandResponse | null> {
    try {
      await this.service.delete(id);

      return {
        sucess: true,
      };
    } catch (error) {
      return {
        sucess: false,
        error: error.message,
      }
    }
  }
}
