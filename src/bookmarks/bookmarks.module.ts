import { DatabaseModule } from '@libs/database';
import { Module } from '@nestjs/common';
import { ArticlesModule } from '../articles/articles.module';
import { BookmarksController } from './bookmarks.controller';
import { BookmarksService } from './bookmarks.service';

@Module({
  imports: [DatabaseModule, ArticlesModule],
  providers: [BookmarksService],
  controllers: [BookmarksController],
  exports: [BookmarksService],
})
export class BookmarksModule {}
