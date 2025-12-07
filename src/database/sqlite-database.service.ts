import { Injectable } from '@nestjs/common';
import * as sqlite3 from 'sqlite3';
import { AbstractDatabaseService } from './abstract-database.service';
import { DatabaseConnection } from './database.interface';

@Injectable()
export class SQLiteDatabaseService extends AbstractDatabaseService {
  private db: sqlite3.Database | null = null;
  private readonly databaseFile: string;

  constructor() {
    super();
    this.databaseFile =
      process.env.DATABASE_FILE || process.env.DATABASE_PATH || 'meridian.db';
  }

  async initDb(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.databaseFile, (err) => {
        if (err) {
          reject(err);
          return;
        }

        console.log('Connected to SQLite database:', this.databaseFile);

        this.createTables()
          .then(() => resolve())
          .catch(reject);
      });
    });
  }

  private createTables(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const createArticlesTable = `
        CREATE TABLE IF NOT EXISTS articles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          url TEXT UNIQUE NOT NULL,
          title TEXT NOT NULL,
          published_date DATETIME NOT NULL,
          feed_source TEXT NOT NULL,
          raw_content TEXT NOT NULL,
          processed_content TEXT,
          embedding TEXT,
          impact_rating INTEGER,
          feed_profile TEXT NOT NULL,
          image_url TEXT,
          categories TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;

      const createBriefingsTable = `
        CREATE TABLE IF NOT EXISTS briefings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          content TEXT NOT NULL,
          article_ids TEXT NOT NULL,
          feed_profile TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;

      const createYoutubeTranscriptionsTable = `
        CREATE TABLE IF NOT EXISTS youtube_transcriptions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          channel_id TEXT NOT NULL,
          channel_name TEXT NOT NULL,
          video_title TEXT NOT NULL,
          posted_at TEXT NOT NULL,
          video_url TEXT UNIQUE NOT NULL,
          processed_at DATETIME NOT NULL,
          transcription_text TEXT NOT NULL,
          transcription_summary TEXT NULL,
          transcription_analysis TEXT NULL,
          transcription_cassification TEXT NULL
        )
      `;

      this.db.serialize(() => {
        this.db!.run(createArticlesTable, (err) => {
          if (err) {
            reject(err);
            return;
          }
        });

        this.db!.run(createBriefingsTable, (err) => {
          if (err) {
            reject(err);
            return;
          }
        });

        this.db!.run(createYoutubeTranscriptionsTable, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    });
  }

  getDbConnection(): DatabaseConnection {
    if (!this.db) {
      throw new Error('Database not initialized. Call initDb() first.');
    }
    return this.db as unknown as DatabaseConnection;
  }

  async closeDb(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve();
        return;
      }

      this.db.close((err) => {
        if (err) {
          reject(err);
        } else {
          console.log('SQLite database connection closed');
          this.db = null;
          resolve();
        }
      });
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.closeDb();
  }
}
