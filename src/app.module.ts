import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { AiModule } from './ai/ai.module';
import { ArticlesModule } from './articles/articles.module';
import { BriefingsModule } from './briefings/briefings.module';
import { ProfilesModule } from './profiles/profiles.module';
import { ScraperModule } from './scraper/scraper.module';
import { ProcessorModule } from './processor/processor.module';
import { BriefingModule } from './briefing/briefing.module';
import { TechModule } from './tech/tech.module';
import { YoutubeTranscriptionsModule } from './youtube-transcriptions/youtube-transcriptions.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    AiModule,
    ArticlesModule,
    BriefingsModule,
    ProfilesModule,
    ScraperModule,
    ProcessorModule,
    BriefingModule,
    TechModule,
    YoutubeTranscriptionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
