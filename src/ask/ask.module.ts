import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ArticlesModule } from '../articles/articles.module';
import { ConfigModule } from '../config/config.module';
import { YoutubeTranscriptionsModule } from '../youtube-transcriptions/youtube-transcriptions.module';
import { ANSWERER } from './answerer';
import { AskController } from './ask.controller';
import { AskService } from './ask.service';
import { ChatAnswerer } from './chat-answerer';

@Module({
  imports: [
    AiModule,
    ArticlesModule,
    ConfigModule,
    YoutubeTranscriptionsModule,
  ],
  providers: [AskService, { provide: ANSWERER, useClass: ChatAnswerer }],
  controllers: [AskController],
})
export class AskModule {}
