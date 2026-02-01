import { DatabaseModule } from '@libs/database';
import { S3Module } from '@libs/s3';
import { Module } from '@nestjs/common';
import { AudioFilesService } from './audio-files.service';

@Module({
  imports: [DatabaseModule, S3Module],
  providers: [AudioFilesService],
  exports: [AudioFilesService],
})
export class AudioFilesModule { }
