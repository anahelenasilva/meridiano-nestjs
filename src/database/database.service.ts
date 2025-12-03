import { Injectable } from '@nestjs/common';
import { AbstractDatabaseService } from './abstract-database.service';
import { PostgresDatabaseService } from './postgres-database.service';
import { SQLiteDatabaseService } from './sqlite-database.service';

// Factory service that provides the appropriate database implementation
@Injectable()
export class DatabaseService extends AbstractDatabaseService {
  private implementation: AbstractDatabaseService;

  constructor() {
    super();
    const databaseType = (process.env.DATABASE_TYPE || 'sqlite').toLowerCase();

    if (databaseType === 'postgres' || databaseType === 'postgresql') {
      this.implementation = new PostgresDatabaseService();
      console.log('Using PostgreSQL database');
    } else {
      this.implementation = new SQLiteDatabaseService();
      console.log('Using SQLite database (default)');
    }
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
