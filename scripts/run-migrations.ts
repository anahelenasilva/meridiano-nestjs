import * as dotenv from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import { typeormConfig } from '../libs/database/typeorm.config';

dotenv.config({ override: false });

async function runMigrationsWithDataSource(config: DataSourceOptions, maxRetries = 5, delayMs = 2000): Promise<void> {
  const dataSource = new DataSource(config);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Migration attempt ${attempt}/${maxRetries}...`);
      await dataSource.initialize();
      console.log('Database connection established');

      await dataSource.runMigrations({
        transaction: 'all',
      });

      console.log('Migrations completed successfully');
      await dataSource.destroy();
      return;
    } catch (error) {
      console.error(`Migration attempt ${attempt} failed:`, error instanceof Error ? error.message : error);

      if (dataSource.isInitialized) {
        try {
          await dataSource.destroy();
        } catch (destroyError) {
          console.error('Error destroying data source:', destroyError);
        }
      }

      if (attempt < maxRetries) {
        console.log(`Retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        delayMs = Math.min(delayMs * 1.5, 10000);
      } else {
        throw error;
      }
    }
  }
}

async function runMigrationsWithRetry(): Promise<void> {
  const privateUrl = process.env.DATABASE_URL;
  const publicUrl = process.env.DATABASE_PUBLIC_URL || process.env.POSTGRES_PUBLIC_URL;

  if (publicUrl) {
    console.log('Using public database URL for migrations...');
    const publicConfig: DataSourceOptions = {
      ...typeormConfig,
      url: publicUrl,
    } as DataSourceOptions;

    try {
      await runMigrationsWithDataSource(publicConfig, 5, 2000);
      process.exit(0);
    } catch (error) {
      console.error('Public URL failed, error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  } else {
    console.log('No public URL found, using DATABASE_URL...');
    const config: DataSourceOptions = typeormConfig;

    try {
      await runMigrationsWithDataSource(config, 5, 2000);
      process.exit(0);
    } catch (error) {
      console.error('Migrations failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }
}

runMigrationsWithRetry().catch((error) => {
  console.error('Fatal error running migrations:', error);
  process.exit(1);
});
