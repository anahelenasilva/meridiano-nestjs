import { Module } from '@nestjs/common';
import { BriefingModule } from '../briefing/briefing.module';
import { ConfigModule } from '../config/config.module';
import { ProcessorModule } from '../processor/processor.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { ScraperModule } from '../scraper/scraper.module';
import { YoutubeTranscriptionsModule } from '../youtube-transcriptions/youtube-transcriptions.module';
import { CategorizeArticlesUseCase } from './briefing/categorize-articles.usecase';
import { GenerateBriefUseCase } from './briefing/generate-brief.usecase';
import { GenerateSimpleBriefUseCase } from './briefing/generate-simple-brief.usecase';
import { ProcessArticlesUseCase } from './briefing/process-articles.usecase';
import { RateArticlesUseCase } from './briefing/rate-articles.usecase';
import { RunBriefingUseCase } from './briefing/run-briefing.usecase';
import { ScrapeArticlesUseCase } from './briefing/scrape-articles.usecase';
import { ExtractYoutubeTranscriptsUseCase } from './youtube-transcriptions/extract-youtube-transcripts.usecase';
import { ListTranscriptionsUseCase } from './youtube-transcriptions/list-transcriptions.usecase';
import { ProcessTranscriptionFilesUseCase } from './youtube-transcriptions/process-transcription-files.usecase';

@Module({
  imports: [
    ScraperModule,
    ProcessorModule,
    BriefingModule,
    ProfilesModule,
    YoutubeTranscriptionsModule,
    ConfigModule,
  ],
  providers: [
    // Briefing usecases
    ScrapeArticlesUseCase,
    ProcessArticlesUseCase,
    RateArticlesUseCase,
    CategorizeArticlesUseCase,
    GenerateBriefUseCase,
    GenerateSimpleBriefUseCase,
    RunBriefingUseCase,
    // YouTube transcription usecases
    ExtractYoutubeTranscriptsUseCase,
    ProcessTranscriptionFilesUseCase,
    ListTranscriptionsUseCase,
  ],
  exports: [
    // Briefing usecases
    ScrapeArticlesUseCase,
    ProcessArticlesUseCase,
    RateArticlesUseCase,
    CategorizeArticlesUseCase,
    GenerateBriefUseCase,
    GenerateSimpleBriefUseCase,
    RunBriefingUseCase,
    // YouTube transcription usecases
    ExtractYoutubeTranscriptsUseCase,
    ProcessTranscriptionFilesUseCase,
    ListTranscriptionsUseCase,
  ],
})
export class UsecasesModule { }
