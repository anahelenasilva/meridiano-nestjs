import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { YoutubeTranscriptionsService } from '../services/youtube-transcriptions.service';

export type CreateYoutubeTranscriptionCommandInput = {
  url: string;
  channelId: string;
  customPrompt?: string;
  generateAudio?: boolean;
};

export type CreateYoutubeTranscriptionCommandResponse = {
  success: boolean;
  transcriptionId?: string;
  message: string;
};

@Injectable()
export class CreateYoutubeTranscriptionCommand {
  constructor(private readonly service: YoutubeTranscriptionsService) {}

  async execute(
    input: CreateYoutubeTranscriptionCommandInput,
  ): Promise<CreateYoutubeTranscriptionCommandResponse> {
    const { url, channelId, customPrompt, generateAudio } = input;

    try {
      const transcriptionId = await this.service.processSingleVideoUrl(
        url,
        channelId,
        undefined,
        customPrompt,
        generateAudio,
      );

      if (transcriptionId === null) {
        throw new BadRequestException('Video already exists in database');
      }

      return {
        success: true,
        transcriptionId,
        message: 'Video transcription saved successfully',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      if (errorMessage.includes('not found in configuration')) {
        throw new NotFoundException('Channel not found in configuration');
      }

      if (errorMessage.includes('is disabled')) {
        throw new BadRequestException('Channel is disabled');
      }

      if (errorMessage.includes('Invalid YouTube URL')) {
        throw new BadRequestException('Invalid YouTube URL format');
      }

      if (errorMessage.includes('No transcript available')) {
        throw new BadRequestException('No transcript available for this video');
      }

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      // Generic error
      throw new BadRequestException(`Failed to process video: ${errorMessage}`);
    }
  }
}
