import { RedisModule } from '@libs/redis';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueueModule } from '../../libs/queue/queue.module';
import { AiModule } from '../ai/ai.module';
import { ArticlesModule } from '../articles/articles.module';
import { ConfigModule } from '../config/config.module';
import { ProcessorModule } from '../processor/processor.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { ScraperModule } from '../scraper/scraper.module';
import { ArticleClusterer } from './article-clusterer';
import { BriefingsController } from './briefings.controller';
import { BriefingsService } from './briefings.service';
import { BriefingEntity } from './entities/briefing.entity';
import { CustomBriefingProcessor } from './processors/custom-briefing.processor';
import { ListBriefingsQuery } from './queries/list-briefings.query';
import { BriefingGenerationService } from './services/briefing-generation.service';
import { CategorizeArticlesUseCase } from './usecases/categorize-articles.usecase';
import { GenerateBriefUseCase } from './usecases/generate-brief.usecase';
import { GenerateCustomBriefUseCase } from './usecases/generate-custom-brief.usecase';
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
    QueueModule,
    RedisModule,
  ],
  providers: [
    BriefingsService,
    BriefingGenerationService,
    ArticleClusterer,
    ListBriefingsQuery,
    CustomBriefingProcessor,
    CategorizeArticlesUseCase,
    GenerateBriefUseCase,
    GenerateCustomBriefUseCase,
    ProcessArticlesUseCase,
    RateArticlesUseCase,
    RunBriefingUseCase,
    ScrapeArticlesUseCase,
  ],
  controllers: [BriefingsController],
  exports: [BriefingsService, BriefingGenerationService],
})
export class BriefingsModule { }
