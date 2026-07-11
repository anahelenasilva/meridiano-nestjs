import { AudioModule } from '@libs/audio';
import { DatabaseModule } from '@libs/database';
import { RedisModule } from '@libs/redis';
import { S3Module } from '@libs/s3';
import { Module } from '@nestjs/common';
import { AudioFilesModule } from '../audio-files/audio-files.module';
import { NotesCleanupModule } from '../notes/notes-cleanup.module';
import { NotesReadModule } from '../notes/notes-read.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { GenerateArticleAudioCommand } from './commands/generate-article-audio.command';
import { ArticlesService } from './articles.service';
import { GetArticleByIdQuery } from './queries/get-article-by-id.query';
import { ListArticlesQuery } from './queries/list-articles.query';
import { TelegramSubmissionService } from './services/telegram-submission.service';

@Module({
  imports: [
    DatabaseModule,
    ProfilesModule,
    S3Module,
    RedisModule,
    AudioFilesModule,
    AudioModule,
    NotesReadModule,
    NotesCleanupModule,
  ],
  providers: [
    ArticlesService,
    GenerateArticleAudioCommand,
    ListArticlesQuery,
    GetArticleByIdQuery,
    TelegramSubmissionService,
  ],
  exports: [
    ArticlesService,
    TelegramSubmissionService,
    GenerateArticleAudioCommand,
    ListArticlesQuery,
    GetArticleByIdQuery,
  ],
})
export class ArticlesModule {}
