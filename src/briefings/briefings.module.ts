import { Module } from '@nestjs/common';
import { ArticlesService } from '../articles/articles.service';
import { DatabaseModule } from '../database/database.module';
import { BriefingsController } from './briefings.controller';
import { BriefingsService } from './briefings.service';
import { ListBriefingsQuery } from './queries/list-briefings.query';

@Module({
  imports: [DatabaseModule],
  providers: [BriefingsService, ArticlesService, ListBriefingsQuery],
  controllers: [BriefingsController],
  exports: [BriefingsService],
})
export class BriefingsModule {}
