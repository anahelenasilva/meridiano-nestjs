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

// Wrapper to make PostgreSQL Pool/Client compatible with SQLite-like API
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

    this.pool.query(
      querySql,
      params || [],
      (err: Error | null, res?: QueryResult) => {
        if (res) {
          // For INSERT with RETURNING, get the id from the first row
          if (isInsert && res.rows[0]?.id) {
            result.lastID = Number(res.rows[0].id);
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
    this.pool.query(
      sql,
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
    this.pool.query(
      sql,
      params || [],
      (err: Error | null, res?: QueryResult) => {
        if (callback) {
          callback(err, err ? undefined : res?.rows[0]);
        }
      },
    );
  }

  serialize(callback: () => void): void {
    // PostgreSQL doesn't need serialization like SQLite, just run the callback
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

    this.pool.query(
      querySql,
      params,
      (err: Error | null, res?: QueryResult) => {
        if (res) {
          // For INSERT with RETURNING, get the id from the first row
          if (isInsert && res.rows[0]?.id) {
            result.lastID = Number(res.rows[0].id);
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
    // PostgreSQL doesn't need to finalize prepared statements like SQLite
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
    const dbUser = process.env.DB_USER || 'postgres';
    const dbPassword = process.env.DB_PASSWORD || '';
    const dbHost = process.env.DB_HOST || 'localhost';
    const dbPort = process.env.DB_PORT || '5432';
    const dbName = process.env.DB_NAME || 'meridian';
    const builtDbUrl = `postgresql://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}`;

    const connectionString = process.env.DATABASE_URL || builtDbUrl;

    this.pool = new Pool({
      connectionString,
    });

    try {
      // Test connection
      const client = await this.pool.connect();
      console.log('Connected to PostgreSQL database');
      client.release();

      await this.createTables();
    } catch (err) {
      console.error('Error connecting to PostgreSQL:', err);
      throw err;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }

    const createArticlesTable = `
      CREATE TABLE IF NOT EXISTS articles (
        id SERIAL PRIMARY KEY,
        url TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        published_date TIMESTAMP NOT NULL,
        feed_source TEXT NOT NULL,
        raw_content TEXT NOT NULL,
        processed_content TEXT,
        embedding TEXT,
        impact_rating INTEGER,
        feed_profile TEXT NOT NULL,
        image_url TEXT,
        categories TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createBriefingsTable = `
      CREATE TABLE IF NOT EXISTS briefings (
        id SERIAL PRIMARY KEY,
        content TEXT NOT NULL,
        article_ids TEXT NOT NULL,
        feed_profile TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createYoutubeTranscriptionsTable = `
      CREATE TABLE IF NOT EXISTS youtube_transcriptions (
        id SERIAL PRIMARY KEY,
        channel_id TEXT NOT NULL,
        channel_name TEXT NOT NULL,
        video_title TEXT NOT NULL,
        posted_at TEXT NULL,
        video_url TEXT UNIQUE NOT NULL,
        processed_at TIMESTAMP NOT NULL,
        transcription_text TEXT NOT NULL,
        transcription_summary TEXT NULL,
        transcription_analysis TEXT NULL,
        transcription_cassification TEXT NULL
      )
    `;

    try {
      await this.pool.query(createArticlesTable);
      await this.pool.query(createBriefingsTable);
      await this.pool.query(createYoutubeTranscriptionsTable);
      console.log('PostgreSQL tables created/verified');
    } catch (err) {
      console.error('Error creating tables:', err);
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
