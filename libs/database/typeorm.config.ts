import * as dotenv from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';

// Reads process.env directly: this file is loaded by the TypeORM CLI
// (migration:generate/run/revert) outside of Nest's DI container, so there
// is no ConfigService instance to inject.
dotenv.config({ override: false });

const connectionString =
  process.env.DATABASE_URL ||
  (() => {
    const dbUser = process.env.DATABASE_USER || process.env.PGUSER || 'postgres';
    const dbPassword = process.env.DATABASE_PASSWORD || process.env.PGPASSWORD || 'postgres';
    const dbHost = process.env.DATABASE_HOST || process.env.PGHOST || 'localhost';
    const dbPort = process.env.DATABASE_PORT || process.env.PGPORT || '5432';
    const dbName = process.env.DATABASE_NAME || process.env.PGDATABASE || 'meridian';

    console.log(`  Connecting to database at ${dbHost}:${dbPort}/${dbName} (user: ${dbUser})`);

    const encodedUser = encodeURIComponent(dbUser);
    const encodedPassword = encodeURIComponent(dbPassword);
    return `postgresql://${encodedUser}:${encodedPassword}@${dbHost}:${dbPort}/${dbName}`;
  })();

console.log('  Connecting to TypeORM database using connection string');

export const typeormConfig: DataSourceOptions = {
  type: 'postgres',
  url: connectionString,
  entities: [],
  migrations: ['dist/src/database/migrations/*.js'],
  migrationsTableName: 'typeorm_migrations',
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
};

const dataSource = new DataSource(typeormConfig);

export default dataSource;
