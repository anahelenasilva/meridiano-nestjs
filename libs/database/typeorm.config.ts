import * as dotenv from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';

dotenv.config({ override: false });

const privateUrl = process.env.DATABASE_URL;
const publicUrl = process.env.DATABASE_PUBLIC_URL;

const connectionString =
  privateUrl ||
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

const isPrivateUrl = connectionString.includes('.railway.internal');
console.log(`  TypeORM using ${isPrivateUrl ? 'PRIVATE' : 'PUBLIC'} database URL`);
console.log(`  Connection string: ${connectionString}`);
console.log(`  process.env.DATABASE_SSL: `, process.env.DATABASE_SSL);

export const typeormConfig: DataSourceOptions = {
  type: 'postgres',
  url: connectionString,
  entities: [],
  migrations: ['dist/src/database/migrations/*.js'],
  migrationsTableName: 'typeorm_migrations',
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  ssl: process.env.DATABASE_SSL === 'true' || isPrivateUrl ? { rejectUnauthorized: false } : false,
};

export { publicUrl };

const dataSource = new DataSource(typeormConfig);

export default dataSource;
