import * as dotenv from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';

dotenv.config();

const dbUser = process.env.DB_USER || 'postgres';
const dbPassword = process.env.DB_PASSWORD || 'postgres';
const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = process.env.DB_PORT || '5432';
const dbName = process.env.DB_NAME || 'meridian';
const builtDbUrl = `postgresql://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}`;

const connectionString = process.env.DATABASE_URL || builtDbUrl;

export const typeormConfig: DataSourceOptions = {
  type: 'postgres',
  url: connectionString,
  // Entities will be added here when we create them
  // For now, we're using raw SQL through the existing DatabaseService
  entities: [],
  migrations: ['dist/database/migrations/*.js'],
  migrationsTableName: 'typeorm_migrations',
  synchronize: false, // Never use true in production - always use migrations
  logging: process.env.NODE_ENV === 'development',
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
};

const dataSource = new DataSource(typeormConfig);

export default dataSource;

