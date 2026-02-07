import * as dotenv from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';

dotenv.config({ override: false });

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.PGDATABASE_URL ||
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

console.log(`  Connecting to TypeORM database using connection string: ${connectionString}`);
console.log(`  process.env.DATABASE_SSL: `, process.env.DATABASE_SSL);

export const typeormConfig: DataSourceOptions = {
  type: 'postgres',
  url: connectionString,
  // Entities will be added here when we create them
  // For now, we're using raw SQL through the existing DatabaseService
  entities: [],
  migrations: ['dist/src/database/migrations/*.js'],
  migrationsTableName: 'typeorm_migrations',
  synchronize: false, // Never use true in production - always use migrations
  logging: process.env.NODE_ENV === 'development',
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
};

const dataSource = new DataSource(typeormConfig);

export default dataSource;
