import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ConfigService } from '../../config/config.service';
import { VideoWithTranscript } from '../../shared/types/video';
import { YoutubeTranscriptionsService } from '../../youtube-transcriptions/youtube-transcriptions.service';
import {
  ProcessTranscriptionFilesInputDto,
  ProcessTranscriptionFilesOutputDto,
} from './dto/process-transcription-files.dto';

@Injectable()
export class ProcessTranscriptionFilesUseCase {
  constructor(
    private readonly youtubeTranscriptionsService: YoutubeTranscriptionsService,
    private readonly configService: ConfigService,
  ) { }

  async execute(
    input: ProcessTranscriptionFilesInputDto,
  ): Promise<ProcessTranscriptionFilesOutputDto> {
    const transcriptsDir = input.transcriptsDir || path.join(process.cwd(), 'transcripts');

    const stats: ProcessTranscriptionFilesOutputDto = {
      totalFiles: 0,
      processed: 0,
      skipped: 0,
      errors: 0,
      errorDetails: [],
    };

    try {
      await fs.access(transcriptsDir);
    } catch {
      return stats;
    }

    const ytConfig = this.configService.getYoutubeChannelsConfig();
    const files = await fs.readdir(transcriptsDir);
    const jsonFiles = files.filter((file) => file.endsWith('.json') && !file.startsWith('.'));

    stats.totalFiles = jsonFiles.length;

    for (const filename of jsonFiles) {
      try {
        const filePath = path.join(transcriptsDir, filename);
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const videoData: VideoWithTranscript = JSON.parse(fileContent);

        if (!videoData.channel?.id) {
          stats.skipped++;
          continue;
        }

        const channelData = ytConfig.channels[videoData.channel.id];

        if (!channelData || channelData.enabled === false) {
          stats.skipped++;
          continue;
        }

        const result = await this.youtubeTranscriptionsService.processTranscriptionFile(videoData);

        if (result.success) {
          stats.processed++;
        } else {
          stats.errors++;
          stats.errorDetails.push({
            file: filename,
            error: result.error || 'Unknown error',
          });
        }
      } catch (error) {
        stats.errors++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        stats.errorDetails.push({ file: filename, error: errorMessage });
      }
    }

    return stats;
  }
}
