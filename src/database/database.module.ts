import { Global, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DatabaseService } from './database.service';
import { typeormConfig } from './typeorm.config';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRoot({
      ...typeormConfig,
      autoLoadEntities: true,
    }),
  ],
  providers: [DatabaseService],
  exports: [DatabaseService, TypeOrmModule],
})
export class DatabaseModule implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly dataSource: DataSource,
  ) { }

  async onModuleInit() {
    // Run migrations automatically on startup for PostgreSQL
    try {
      console.log('Running pending migrations...');
      await this.dataSource.runMigrations({
        transaction: 'all',
      });
      console.log('Migrations completed successfully');
    } catch (error) {
      console.error('Error running migrations:', error);
      // Don't throw - allow app to start even if migrations fail
      // This is useful for development when tables might already exist
    }

    // Initialize the legacy database service for backward compatibility
    // await this.databaseService.initDb();
  }

  async onModuleDestroy() {
    await this.databaseService.closeDb();
  }
}
