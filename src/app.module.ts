import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AiModule } from './ai/ai.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ArticlesModule } from './articles/articles.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { BookmarksModule } from './bookmarks/bookmarks.module';
import { BriefingModule } from './briefing/briefing.module';
import { BriefingsModule } from './briefings/briefings.module';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { ProcessorModule } from './processor/processor.module';
import { ProfilesModule } from './profiles/profiles.module';
import { QueueModule } from './queue/queue.module';
import { S3Module } from '../libs/s3/s3.module';
import { ScraperModule } from './scraper/scraper.module';
import { TechModule } from './tech/tech.module';
import { UsecasesModule } from './usecases/usecases.module';
import { UsersModule } from './users/users.module';
import { YoutubeChannelsModule } from './youtube-channels/youtube-channels.module';
import { YoutubeTranscriptionsModule } from './youtube-transcriptions/youtube-transcriptions.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    AuthModule,
    AiModule,
    ArticlesModule,
    BriefingsModule,
    ProfilesModule,
    ScraperModule,
    ProcessorModule,
    BriefingModule,
    TechModule,
    YoutubeChannelsModule,
    YoutubeTranscriptionsModule,
    QueueModule,
    UsecasesModule,
    UsersModule,
    BookmarksModule,
    S3Module,
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
export class AppModule { }
