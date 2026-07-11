import { DatabaseModule } from '@libs/database';
import { Module } from '@nestjs/common';
import { NotesCleanupService } from './notes-cleanup.service';

@Module({
  imports: [DatabaseModule],
  providers: [NotesCleanupService],
  exports: [NotesCleanupService],
})
export class NotesCleanupModule {}
