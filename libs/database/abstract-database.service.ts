import { OnModuleDestroy } from '@nestjs/common';
import { DatabaseConnection } from './database.interface';

export abstract class AbstractDatabaseService implements OnModuleDestroy {
  abstract initDb(): Promise<void>;
  abstract getDbConnection(): DatabaseConnection;
  abstract closeDb(): Promise<void>;
  abstract onModuleDestroy(): Promise<void>;
}
