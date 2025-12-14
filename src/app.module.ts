import { Module } from '@nestjs/common';
import { AiModule } from './ai/ai.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ArticlesModule } from './articles/articles.module';
import { BriefingModule } from './briefing/briefing.module';
import { BriefingsModule } from './briefings/briefings.module';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { ProcessorModule } from './processor/processor.module';
import { ProfilesModule } from './profiles/profiles.module';
import { QueueModule } from './queue/queue.module';
import { ScraperModule } from './scraper/scraper.module';
import { TechModule } from './tech/tech.module';
import { UsecasesModule } from './usecases/usecases.module';
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
    QueueModule,
    UsecasesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
