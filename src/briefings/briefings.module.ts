import { DatabaseModule } from '@libs/database';
import { Module, forwardRef } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ArticlesService } from '../articles/articles.service';
import { BriefingModule } from '../briefing/briefing.module';
import { ConfigModule } from '../config/config.module';
import { ProcessorModule } from '../processor/processor.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { ScraperModule } from '../scraper/scraper.module';
import { BriefingsController } from './briefings.controller';
import { BriefingsService } from './briefings.service';
import { ListBriefingsQuery } from './queries/list-briefings.query';

// Usecases
import { CategorizeArticlesUseCase } from './usecases/categorize-articles.usecase';
import { GenerateBriefUseCase } from './usecases/generate-brief.usecase';
import { GenerateSimpleBriefUseCase } from './usecases/generate-simple-brief.usecase';
import { ProcessArticlesUseCase } from './usecases/process-articles.usecase';
import { RateArticlesUseCase } from './usecases/rate-articles.usecase';
import { RunBriefingUseCase } from './usecases/run-briefing.usecase';
import { ScrapeArticlesUseCase } from './usecases/scrape-articles.usecase';

@Module({
  imports: [
    DatabaseModule,
    forwardRef(() => BriefingModule),
    ProcessorModule,
    ProfilesModule,
    ScraperModule,
    ConfigModule,
    AiModule,
  ],
  providers: [
    BriefingsService,
    ArticlesService,
    ListBriefingsQuery,
    // Briefing usecases
    CategorizeArticlesUseCase,
    GenerateBriefUseCase,
    GenerateSimpleBriefUseCase,
    ProcessArticlesUseCase,
    RateArticlesUseCase,
    RunBriefingUseCase,
    ScrapeArticlesUseCase,
  ],
  controllers: [BriefingsController],
  exports: [
    BriefingsService,
    // Export usecases for external use
    CategorizeArticlesUseCase,
    GenerateBriefUseCase,
    GenerateSimpleBriefUseCase,
    ProcessArticlesUseCase,
    RateArticlesUseCase,
    RunBriefingUseCase,
    ScrapeArticlesUseCase,
  ],
})
export class BriefingsModule { }
