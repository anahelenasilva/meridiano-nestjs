import { Injectable } from '@nestjs/common';
import { AbstractDatabaseService } from './abstract-database.service';
import { PostgresDatabaseService } from './postgres-database.service';

// Factory service that provides the appropriate database implementation
@Injectable()
export class DatabaseService extends AbstractDatabaseService {
  private implementation: AbstractDatabaseService;

  constructor() {
    super();

    this.implementation = new PostgresDatabaseService();
    console.log('Using PostgreSQL database');
  }

  async initDb(): Promise<void> {
    return this.implementation.initDb();
  }

  getDbConnection() {
    return this.implementation.getDbConnection();
  }

  async closeDb(): Promise<void> {
    return this.implementation.closeDb();
  }

  async onModuleDestroy(): Promise<void> {
    return this.implementation.onModuleDestroy();
  }
}
