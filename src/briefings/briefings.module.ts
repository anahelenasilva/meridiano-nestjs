import { DatabaseModule } from '@libs/database';
import { Module } from '@nestjs/common';
import { ArticlesService } from '../articles/articles.service';
import { BriefingsController } from './briefings.controller';
import { BriefingsService } from './briefings.service';
import { ListBriefingsQuery } from './queries/list-briefings.query';

@Module({
  imports: [DatabaseModule],
  providers: [BriefingsService, ArticlesService, ListBriefingsQuery],
  controllers: [BriefingsController],
  exports: [BriefingsService],
})
export class BriefingsModule { }
