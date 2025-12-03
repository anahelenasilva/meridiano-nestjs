import { Global, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from './database.service';

@Global()
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly databaseService: DatabaseService) {}

  async onModuleInit() {
    await this.databaseService.initDb();
  }

  async onModuleDestroy() {
    await this.databaseService.closeDb();
  }
}
