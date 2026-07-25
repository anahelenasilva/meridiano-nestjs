import { JwtAuthGuard } from '@libs/auth';
import { DatabaseModule } from '@libs/database';
import { QueueModule } from '@libs/queue';
import { S3Module } from '@libs/s3';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AiModule } from './ai/ai.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ArticlesModule } from './articles/articles.module';
import { AudioFilesModule } from './audio-files/audio-files.module';
import { AuthModule } from './auth/auth.module';
import { BookmarksModule } from './bookmarks/bookmarks.module';
import { BriefingsModule } from './briefings/briefings.module';
import { ConfigModule } from './config/config.module';
import { FeedsModule } from './feeds/feeds.module';
import { ProcessorModule } from './processor/processor.module';
import { ProfilesModule } from './profiles/profiles.module';
import { ScraperModule } from './scraper/scraper.module';
import { UsersModule } from './users/users.module';
import { NewsDigestModule } from './news-digest/news-digest.module';
import { NotesModule } from './notes/notes.module';
import { YoutubeChannelsModule } from './youtube-channels/youtube-channels.module';
import { YoutubeTranscriptionsModule } from './youtube-transcriptions/youtube-transcriptions.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    AuthModule,
    AiModule,
    ArticlesModule,
    AudioFilesModule,
    BriefingsModule,
    FeedsModule,
    ProfilesModule,
    ScraperModule,
    ProcessorModule,
    YoutubeChannelsModule,
    YoutubeTranscriptionsModule,
    QueueModule,
    UsersModule,
    BookmarksModule,
    S3Module,
    NewsDigestModule,
    NotesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
