import { Injectable } from '@nestjs/common';
import { Pool, QueryResult } from 'pg';
import { AbstractDatabaseService } from './abstract-database.service';
import {
  DatabaseConnection,
  PreparedStatement,
  RunCallback,
  RunCallbackContext,
  RunResult,
} from './database.interface';

// Helper function to convert ? placeholders to PostgreSQL-style $1, $2, etc.
function convertPlaceholders(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => {
    index++;
    return `$${index}`;
  });
}

class PostgresConnection implements DatabaseConnection {
  constructor(private pool: Pool) { }

  prepare(sql: string): PreparedStatement {
    return new PostgresPreparedStatement(this.pool, sql);
  }

  run(sql: string, params?: any[], callback?: RunCallback): RunResult {
    const result: RunResult = {};

    let querySql = sql;
    const isInsert = /^\s*INSERT\s+/i.test(sql.trim());
    if (isInsert && !/RETURNING/i.test(sql)) {
      querySql = sql.replace(/;?\s*$/, '') + ' RETURNING id';
    }

    querySql = convertPlaceholders(querySql);

    this.pool.query(
      querySql,
      params || [],
      (err: Error | null, res?: QueryResult) => {
        if (res) {
          if (isInsert && res.rows[0]?.id) {
            result.lastID = String(res.rows[0].id);
          }

          result.changes = res.rowCount || 0;
        }
        if (callback) {
          const callbackContext: RunCallbackContext = {
            lastID: result.lastID,
            changes: result.changes,
          };
          callback.call(callbackContext, err);
        }
      },
    );
    return result;
  }

  all(
    sql: string,
    params?: any[],
    callback?: (err: Error | null, rows?: any[]) => void,
  ): void {
    const querySql = convertPlaceholders(sql);

    this.pool.query(
      querySql,
      params || [],
      (err: Error | null, res?: QueryResult) => {
        if (callback) {
          callback(err, err ? undefined : res?.rows);
        }
      },
    );
  }

  get(
    sql: string,
    params?: any[],
    callback?: (err: Error | null, row?: any) => void,
  ): void {
    const querySql = convertPlaceholders(sql);

    this.pool.query(
      querySql,
      params || [],
      (err: Error | null, res?: QueryResult) => {
        if (callback) {
          callback(err, err ? undefined : res?.rows[0]);
        }
      },
    );
  }

  serialize(callback: () => void): void {
    callback();
  }

  close(callback?: (err: Error | null) => void): void {
    this.pool.end((err?: Error) => {
      if (callback) {
        callback(err || null);
      }
    });
  }
}

class PostgresPreparedStatement implements PreparedStatement {
  constructor(
    private pool: Pool,
    private sql: string,
  ) { }

  run(params: any[], callback?: RunCallback): RunResult {
    const result: RunResult = {};

    // Modify SQL to include RETURNING id for INSERT statements
    let querySql = this.sql;
    const isInsert = /^\s*INSERT\s+/i.test(this.sql.trim());
    if (isInsert && !/RETURNING/i.test(this.sql)) {
      querySql = this.sql.replace(/;?\s*$/, '') + ' RETURNING id';
    }

    querySql = convertPlaceholders(querySql);

    this.pool.query(
      querySql,
      params,
      (err: Error | null, res?: QueryResult) => {
        if (res) {
          if (isInsert && res.rows[0]?.id) {
            result.lastID = String(res.rows[0].id);
          }
          result.changes = res.rowCount || 0;
        }

        if (callback) {
          const callbackContext: RunCallbackContext = {
            lastID: result.lastID,
            changes: result.changes,
          };
          callback.call(callbackContext, err);
        }
      },
    );
    return result;
  }

  finalize(callback?: (err: Error | null) => void): void {
    if (callback) {
      callback(null);
    }
  }
}

@Injectable()
export class PostgresDatabaseService extends AbstractDatabaseService {
  private pool: Pool | null = null;

  constructor() {
    super();
  }

  async initDb(): Promise<void> {
    const connectionString =
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      process.env.PGDATABASE_URL ||
      (() => {
        const dbUser = process.env.DATABASE_USER || process.env.PGUSER || 'postgres';
        const dbPassword = process.env.DATABASE_PASSWORD || process.env.PGPASSWORD || '';
        const dbHost = process.env.DATABASE_HOST || process.env.PGHOST || 'localhost';
        const dbPort = process.env.DATABASE_PORT || process.env.PGPORT || '5432';
        const dbName = process.env.DATABASE_NAME || process.env.PGDATABASE || 'meridian';

        console.log(`  Connecting to PostgreSQL database at ${dbHost}:${dbPort}/${dbName} (user: ${dbUser})`);

        const encodedUser = encodeURIComponent(dbUser);
        const encodedPassword = encodeURIComponent(dbPassword);
        return `postgresql://${encodedUser}:${encodedPassword}@${dbHost}:${dbPort}/${dbName}`;
      })();

    // const isRailway = process.env.RAILWAY_ENVIRONMENT === 'production' ||
    //                   process.env.RAILWAY_ENVIRONMENT_NAME !== undefined ||
    //                   connectionString.includes('.railway.app') ||
    //                   connectionString.includes('.railway.internal') ||
    //                   process.env.DATABASE_HOST?.includes('.railway.internal');

    this.pool = new Pool({
      connectionString,
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    try {
      const client = await this.pool.connect();
      console.log('Connected to PostgreSQL database');
      client.release();
    } catch (err) {
      console.error('Error connecting to PostgreSQL:', err);
      throw err;
    }
  }

  getDbConnection(): DatabaseConnection {
    if (!this.pool) {
      throw new Error('Database not initialized. Call initDb() first.');
    }
    return new PostgresConnection(this.pool);
  }

  async closeDb(): Promise<void> {
    if (!this.pool) {
      return;
    }

    try {
      await this.pool.end();
      console.log('PostgreSQL database connection closed');
      this.pool = null;
    } catch (err) {
      console.error('Error closing PostgreSQL connection:', err);
      throw err;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.closeDb();
  }
}
