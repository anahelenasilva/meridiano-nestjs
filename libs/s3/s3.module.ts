import { Module } from '@nestjs/common';
import { S3Service } from './s3.service';

// No ConfigModule import here: ConfigService is @Global() (registered once
// via AppModule), and this module doesn't need its own import to see it.
@Module({
  providers: [S3Service],
  exports: [S3Service],
})
export class S3Module { }
