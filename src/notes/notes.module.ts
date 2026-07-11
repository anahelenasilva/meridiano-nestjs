import { DatabaseModule } from '@libs/database';
import { Module } from '@nestjs/common';
import { ArticlesModule } from '../articles/articles.module';
import { YoutubeTranscriptionsModule } from '../youtube-transcriptions/youtube-transcriptions.module';
import { NotesController } from './notes.controller';
import { NotesReadModule } from './notes-read.module';
import { NotesService } from './notes.service';

@Module({
  imports: [
    DatabaseModule,
    NotesReadModule,
    ArticlesModule,
    YoutubeTranscriptionsModule,
  ],
  providers: [NotesService],
  controllers: [NotesController],
  exports: [NotesService],
})
export class NotesModule {}
