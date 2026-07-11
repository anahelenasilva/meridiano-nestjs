import { DatabaseModule } from '@libs/database';
import { Module } from '@nestjs/common';
import { NotesReadService } from './notes-read.service';

/**
 * Read-only notes module. Depends only on `DatabaseModule` so that any
 * owner-facing read surface (e.g. Article detail) can embed the active note
 * without importing the write-path `NotesModule` and forming a dependency cycle.
 */
@Module({
  imports: [DatabaseModule],
  providers: [NotesReadService],
  exports: [NotesReadService],
})
export class NotesReadModule {}
