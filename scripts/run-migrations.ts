import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { typeormConfig } from '../libs/database/typeorm.config';

dotenv.config({ override: false });

async function runMigrationsWithRetry(maxRetries = 5, delayMs = 2000): Promise<void> {
  const dataSource = new DataSource(typeormConfig);

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
      process.exit(0);
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
        delayMs *= 1.5;
      } else {
        console.error('All migration attempts failed');
        process.exit(1);
      }
    }
  }
}

runMigrationsWithRetry().catch((error) => {
  console.error('Fatal error running migrations:', error);
  process.exit(1);
});
