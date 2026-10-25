import { DatabaseModule } from '@libs/database';
import { Module } from '@nestjs/common';
import { BookmarksReadService } from './bookmarks-read.service';

/**
 * Read-only bookmarks module. Depends only on `DatabaseModule` so that any read
 * surface that serves articles can embed bookmark state without importing the
 * write-path `BookmarksModule` (which imports `ArticlesModule`) and forming a
 * dependency cycle. See ADR-0005.
 */
@Module({
  imports: [DatabaseModule],
  providers: [BookmarksReadService],
  exports: [BookmarksReadService],
})
export class BookmarksReadModule {}
