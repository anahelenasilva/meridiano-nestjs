import {
  ProcessTranscriptionSummaryJobData,
  YOUTUBE_TRANSCRIPTION_SUMMARY_QUEUE,
} from '@libs/queue';
import { RedisService } from '@libs/redis';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { AiService } from '../../ai/ai.service';
import { GenerateAudioUseCase } from '../../audio-files/usecases/generate-audio.usecase';
import { ConfigService } from '../../config/config.service';
import { YoutubeTranscriptionsService } from '../services/youtube-transcriptions.service';

@Injectable()
export class YoutubeTranscriptionProcessor implements OnModuleInit {
  private worker: Worker;

  constructor(
    private readonly redisService: RedisService,
    private readonly youtubeTranscriptionsService: YoutubeTranscriptionsService,
    private readonly aiService: AiService,
    private readonly configService: ConfigService,
    private readonly generateAudioUseCase: GenerateAudioUseCase,
  ) { }

  onModuleInit() {
    this.worker = new Worker(
      YOUTUBE_TRANSCRIPTION_SUMMARY_QUEUE,
      async (job: Job<ProcessTranscriptionSummaryJobData>) => {
        return await this.processTranscriptionSummary(job);
      },
      {
        connection: this.redisService.getClient(),
        concurrency: 1,
      },
    );

    this.worker.on('completed', (job) => {
      console.log(`Job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`Job ${job?.id} failed with error:`, err);
    });

    console.log('YouTube transcription processor worker initialized');
  }

  async processTranscriptionSummary(
    job: Job<ProcessTranscriptionSummaryJobData>,
  ): Promise<{ success: boolean; message: string }> {
    const { transcriptionId, transcriptText, videoTitle } = job.data;

    console.log(
      `\n>>> Processing transcription summary for ID ${transcriptionId} (${videoTitle}) from queue (Job ${job.id}) <<<`,
    );

    try {
      const summaryPrompt = this.configService.getTranscriptionSummaryPrompt(transcriptText);

      console.log(`Generating summary for transcription ${transcriptionId}...`);
      const summary = await this.aiService.callDeepseekChat(summaryPrompt);

      if (!summary) {
        console.log(
          `Warning: Failed to generate summary for transcription ${transcriptionId}. Transcription saved without summary.`,
        );
        return {
          success: true,
          message: `Transcription ${transcriptionId} saved without summary (AI did not generate summary)`,
        };
      }

      console.log(`Updating transcription ${transcriptionId} with summary...`);
      await this.youtubeTranscriptionsService.updateTranscriptionSummary(
        transcriptionId,
        summary,
      );

      console.log(
        `✓ Transcription ${transcriptionId} summary generated and saved successfully (Job ${job.id})`,
      );

      // Generate audio if flag is enabled
      if (job.data.generateAudio) {
        try {
          console.log(`Generating audio for transcription ID: ${transcriptionId}...`);
          const transcription = await this.youtubeTranscriptionsService.getTranscriptionById(transcriptionId);

          if (transcription) {
            const audioResult = await this.generateAudioUseCase.execute({
              sourceType: 'transcription',
              sourceId: transcriptionId,
              text: summary,
              date: transcription.processedAt,
            });

            if (audioResult.success) {
              console.log(`Audio generated successfully for transcription ID: ${transcriptionId}`);
            } else {
              console.error(`Audio generation failed for transcription ID: ${transcriptionId}: ${audioResult.error}`);
            }
          }
        } catch (audioError) {
          console.error(`Error generating audio for transcription ID: ${transcriptionId}:`, audioError);
        }
      }

      return {
        success: true,
        message: `Transcription ${transcriptionId} summary generated and saved successfully`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(
        `Error processing transcription summary ${transcriptionId} in job ${job.id}:`,
        errorMessage,
      );
      throw new Error(
        `Failed to process transcription summary ${transcriptionId}: ${errorMessage}`,
      );
    }
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
    }
  }
}
