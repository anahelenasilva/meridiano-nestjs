import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import { ArticlesModule } from '../articles/articles.module';
import { ConfigModule } from '../config/config.module';
import { ProcessorModule } from '../processor/processor.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { ScraperModule } from '../scraper/scraper.module';
import { BriefingsController } from './briefings.controller';
import { BriefingsService } from './briefings.service';
import { BriefingEntity } from './entities/briefing.entity';
import { ListBriefingsQuery } from './queries/list-briefings.query';
import { BriefingGenerationService } from './services/briefing-generation.service';
import { CategorizeArticlesUseCase } from './usecases/categorize-articles.usecase';
import { GenerateBriefUseCase } from './usecases/generate-brief.usecase';
import { GenerateSimpleBriefUseCase } from './usecases/generate-simple-brief.usecase';
import { ProcessArticlesUseCase } from './usecases/process-articles.usecase';
import { RateArticlesUseCase } from './usecases/rate-articles.usecase';
import { RunBriefingUseCase } from './usecases/run-briefing.usecase';
import { ScrapeArticlesUseCase } from './usecases/scrape-articles.usecase';

@Module({
  imports: [
    TypeOrmModule.forFeature([BriefingEntity]),
    ArticlesModule,
    ProcessorModule,
    ProfilesModule,
    ScraperModule,
    ConfigModule,
    AiModule,
  ],
  providers: [
    BriefingsService,
    BriefingGenerationService,
    ListBriefingsQuery,
    CategorizeArticlesUseCase,
    GenerateBriefUseCase,
    GenerateSimpleBriefUseCase,
    ProcessArticlesUseCase,
    RateArticlesUseCase,
    RunBriefingUseCase,
    ScrapeArticlesUseCase,
  ],
  controllers: [BriefingsController],
  exports: [BriefingsService, BriefingGenerationService],
})
export class BriefingsModule {}
