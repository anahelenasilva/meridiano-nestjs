import * as dotenv from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';

// Load environment variables from .env file (only if not already set)
// This ensures Docker Compose environment variables take precedence
dotenv.config({ override: false });

const dbUser = process.env.DATABASE_USER || 'postgres';
const dbPassword = process.env.DATABASE_PASSWORD || 'postgres';
const dbHost = process.env.DATABASE_HOST || 'localhost';
const dbPort = process.env.DATABASE_PORT || '5432';
const dbName = process.env.DATABASE_NAME || 'meridian';

console.log(`  Connecting to database at ${dbHost}:${dbPort}/${dbName} (user: ${dbUser})`);

// URL-encode username and password to handle special characters
const encodedUser = encodeURIComponent(dbUser);
const encodedPassword = encodeURIComponent(dbPassword);
const builtDbUrl = `postgresql://${encodedUser}:${encodedPassword}@${dbHost}:${dbPort}/${dbName}`;

const connectionString = process.env.DATABASE_URL || builtDbUrl;

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
