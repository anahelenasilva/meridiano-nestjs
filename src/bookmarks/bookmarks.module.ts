import { Module } from '@nestjs/common';
import { ArticlesModule } from '../articles/articles.module';
import { DatabaseModule } from '../database/database.module';
import { UsersModule } from '../users/users.module';
import { BookmarksController } from './bookmarks.controller';
import { BookmarksService } from './bookmarks.service';

@Module({
  imports: [DatabaseModule, UsersModule, ArticlesModule],
  providers: [BookmarksService],
  controllers: [BookmarksController],
  exports: [BookmarksService],
})
export class BookmarksModule { }
