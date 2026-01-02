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

// Helper function to convert SQLite-style ? placeholders to PostgreSQL-style $1, $2, etc.
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

    // Modify SQL to include RETURNING id for INSERT statements
    let querySql = sql;
    const isInsert = /^\s*INSERT\s+/i.test(sql.trim());
    if (isInsert && !/RETURNING/i.test(sql)) {
      querySql = sql.replace(/;?\s*$/, '') + ' RETURNING id';
    }

    // Convert SQLite-style ? placeholders to PostgreSQL-style $1, $2, etc.
    querySql = convertPlaceholders(querySql);

    this.pool.query(
      querySql,
      params || [],
      (err: Error | null, res?: QueryResult) => {
        if (res) {
          // For INSERT with RETURNING, get the id from the first row
          if (isInsert && res.rows[0]?.id) {
            // Keep UUID as string, don't convert to number
            result.lastID = String(res.rows[0].id);
          }
          result.changes = res.rowCount || 0;
        }
        if (callback) {
          // Set this.lastID and this.changes for callback context (like SQLite does)
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
    // Convert SQLite-style ? placeholders to PostgreSQL-style $1, $2, etc.
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
    // Convert SQLite-style ? placeholders to PostgreSQL-style $1, $2, etc.
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

    // Convert SQLite-style ? placeholders to PostgreSQL-style $1, $2, etc.
    querySql = convertPlaceholders(querySql);

    this.pool.query(
      querySql,
      params,
      (err: Error | null, res?: QueryResult) => {
        if (res) {
          // For INSERT with RETURNING, get the id from the first row
          if (isInsert && res.rows[0]?.id) {
            // Keep UUID as string, don't convert to number
            result.lastID = String(res.rows[0].id);
          }
          result.changes = res.rowCount || 0;
        }

        if (callback) {
          // Set this.lastID and this.changes for callback context (like SQLite does)
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
    const dbUser = process.env.DATABASE_USER || 'postgres';
    const dbPassword = process.env.DATABASE_PASSWORD || '';
    const dbHost = process.env.DATABASE_HOST || 'localhost';
    const dbPort = process.env.DATABASE_PORT || '5432';
    const dbName = process.env.DATABASE_NAME || 'meridian';
    // URL-encode username and password to handle special characters
    const encodedUser = encodeURIComponent(dbUser);
    const encodedPassword = encodeURIComponent(dbPassword);
    const builtDbUrl = `postgresql://${encodedUser}:${encodedPassword}@${dbHost}:${dbPort}/${dbName}`;

    const connectionString = process.env.DATABASE_URL || builtDbUrl;

    this.pool = new Pool({
      connectionString,
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
