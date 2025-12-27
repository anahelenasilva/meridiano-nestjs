import * as dotenv from 'dotenv';
import { Pool } from 'pg';
import { Database } from 'sqlite3';

dotenv.config();

interface MigrationStats {
  inserted: number;
  updated: number;
  errors: number;
  skipped: number;
}

interface TableStats {
  articles: MigrationStats;
  briefings: MigrationStats;
  youtubeTranscriptions: MigrationStats;
}

class MigrationService {
  private sqliteDb: Database | null = null;
  private pgPool: Pool | null = null;
  private stats: TableStats = {
    articles: { inserted: 0, updated: 0, errors: 0, skipped: 0 },
    briefings: { inserted: 0, updated: 0, errors: 0, skipped: 0 },
    youtubeTranscriptions: { inserted: 0, updated: 0, errors: 0, skipped: 0 },
  };

  async connectSQLite(): Promise<void> {
    const databaseFile =
      process.env.DATABASE_FILE || process.env.DATABASE_PATH || 'meridian.db';

    return new Promise((resolve, reject) => {
      this.sqliteDb = new Database(databaseFile, (err) => {
        if (err) {
          reject(err);
          return;
        }
        console.log(`✓ Connected to SQLite database: ${databaseFile}`);
        resolve();
      });
    });
  }

  async connectPostgreSQL(): Promise<void> {
    const dbUser = process.env.DB_USER || 'postgres';
    const dbPassword = process.env.DB_PASSWORD || 'postgres';
    const dbHost = process.env.DB_HOST || 'localhost';
    const dbPort = process.env.DB_PORT || '5432';
    const dbName = process.env.DB_NAME || 'meridian';
    const builtDbUrl = `postgresql://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}`;

    const connectionString = process.env.DATABASE_URL || builtDbUrl;

    this.pgPool = new Pool({ connectionString });

    try {
      const client = await this.pgPool.connect();
      console.log('✓ Connected to PostgreSQL database');
      client.release();
    } catch (err) {
      console.error('Error connecting to PostgreSQL:', err);
      throw err;
    }
  }

  private async readSQLiteTable<T>(
    tableName: string,
  ): Promise<T[]> {
    return new Promise((resolve, reject) => {
      if (!this.sqliteDb) {
        reject(new Error('SQLite database not connected'));
        return;
      }

      this.sqliteDb.all(
        `SELECT * FROM ${tableName}`,
        [],
        (err, rows: T[]) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(rows || []);
        },
      );
    });
  }

  async migrateArticles(): Promise<void> {
    console.log('\n📄 Migrating Articles...');

    try {
      const articles = await this.readSQLiteTable<any>('articles');
      console.log(`Found ${articles.length} articles in SQLite`);

      if (articles.length === 0) {
        console.log('No articles to migrate');
        return;
      }

      const client = await this.pgPool!.connect();

      try {
        await client.query('BEGIN');

        for (let i = 0; i < articles.length; i++) {
          const article = articles[i];

          try {
            // Convert SQLite datetime to PostgreSQL timestamp
            const publishedDate = article.published_date
              ? new Date(article.published_date).toISOString()
              : new Date().toISOString();
            const createdAt = article.created_at
              ? new Date(article.created_at).toISOString()
              : new Date().toISOString();

            const result = await client.query(
              `
              INSERT INTO articles (
                url, title, published_date, feed_source, raw_content,
                processed_content, embedding, impact_rating, feed_profile,
                image_url, categories, created_at
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
              ON CONFLICT (url) DO UPDATE SET
                title = EXCLUDED.title,
                published_date = EXCLUDED.published_date,
                feed_source = EXCLUDED.feed_source,
                raw_content = EXCLUDED.raw_content,
                processed_content = EXCLUDED.processed_content,
                embedding = EXCLUDED.embedding,
                impact_rating = EXCLUDED.impact_rating,
                feed_profile = EXCLUDED.feed_profile,
                image_url = EXCLUDED.image_url,
                categories = EXCLUDED.categories,
                created_at = EXCLUDED.created_at
              RETURNING (xmax = 0) AS inserted
              `,
              [
                article.url,
                article.title,
                publishedDate,
                article.feed_source,
                article.raw_content,
                article.processed_content || null,
                article.embedding || null,
                article.impact_rating || null,
                article.feed_profile,
                article.image_url || null,
                article.categories || null,
                createdAt,
              ],
            );

            if (result.rows[0].inserted) {
              this.stats.articles.inserted++;
            } else {
              this.stats.articles.updated++;
            }

            if ((i + 1) % 100 === 0) {
              console.log(`  Progress: ${i + 1}/${articles.length}`);
            }
          } catch (err) {
            console.error(`  Error migrating article ${article.url}:`, err.message);
            this.stats.articles.errors++;
          }
        }

        await client.query('COMMIT');
        console.log(
          `✓ Articles migration complete: ${this.stats.articles.inserted} inserted, ${this.stats.articles.updated} updated, ${this.stats.articles.errors} errors`,
        );
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('Error migrating articles:', err);
      throw err;
    }
  }

  async migrateBriefings(): Promise<void> {
    console.log('\n📰 Migrating Briefings...');

    try {
      const briefings = await this.readSQLiteTable<any>('briefings');
      console.log(`Found ${briefings.length} briefings in SQLite`);

      if (briefings.length === 0) {
        console.log('No briefings to migrate');
        return;
      }

      const client = await this.pgPool!.connect();

      try {
        await client.query('BEGIN');

        for (let i = 0; i < briefings.length; i++) {
          const briefing = briefings[i];

          try {
            // Convert SQLite datetime to PostgreSQL timestamp
            const createdAt = briefing.created_at
              ? new Date(briefing.created_at).toISOString()
              : new Date().toISOString();

            // Check if this exact briefing already exists
            // Since there's no unique constraint, we check by content + feed_profile + created_at
            const existingResult = await client.query(
              `
              SELECT id FROM briefings
              WHERE content = $1 AND feed_profile = $2 AND created_at = $3
              LIMIT 1
              `,
              [briefing.content, briefing.feed_profile, createdAt],
            );

            if (existingResult.rows.length > 0) {
              // Exact duplicate exists, update it
              await client.query(
                `
                UPDATE briefings
                SET article_ids = $1
                WHERE id = $2
                `,
                [briefing.article_ids, existingResult.rows[0].id],
              );
              this.stats.briefings.updated++;
            } else {
              // Insert new briefing
              await client.query(
                `
                INSERT INTO briefings (content, article_ids, feed_profile, created_at)
                VALUES ($1, $2, $3, $4)
                `,
                [
                  briefing.content,
                  briefing.article_ids,
                  briefing.feed_profile,
                  createdAt,
                ],
              );
              this.stats.briefings.inserted++;
            }

            if ((i + 1) % 50 === 0) {
              console.log(`  Progress: ${i + 1}/${briefings.length}`);
            }
          } catch (err) {
            console.error(`  Error migrating briefing ${briefing.id}:`, err.message);
            this.stats.briefings.errors++;
          }
        }

        await client.query('COMMIT');
        console.log(
          `✓ Briefings migration complete: ${this.stats.briefings.inserted} inserted, ${this.stats.briefings.updated} updated, ${this.stats.briefings.errors} errors`,
        );
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('Error migrating briefings:', err);
      throw err;
    }
  }

  async migrateYoutubeTranscriptions(): Promise<void> {
    console.log('\n🎥 Migrating YouTube Transcriptions...');

    try {
      const transcriptions = await this.readSQLiteTable<any>(
        'youtube_transcriptions',
      );
      console.log(`Found ${transcriptions.length} transcriptions in SQLite`);

      if (transcriptions.length === 0) {
        console.log('No transcriptions to migrate');
        return;
      }

      const client = await this.pgPool!.connect();

      try {
        await client.query('BEGIN');

        for (let i = 0; i < transcriptions.length; i++) {
          const transcription = transcriptions[i];

          try {
            // Convert SQLite datetime to PostgreSQL timestamp
            const processedAt = transcription.processed_at
              ? new Date(transcription.processed_at).toISOString()
              : new Date().toISOString();

            // posted_at might be null or a string
            const postedAt = transcription.posted_at
              ? new Date(transcription.posted_at).toISOString()
              : null;

            console.log(">>>>>>>transcription", JSON.stringify({
              video_title: transcription.video_title,
              channel_name: transcription.channel_name,
              video_url: transcription.video_url,
              thumbnail_url: transcription.thumbnail_url,
              processedAt,
              postedAt,
            }, null, 2));

            // const result = await client.query(
            //   `
            //   INSERT INTO youtube_transcriptions (
            //     channel_id, channel_name, video_title, posted_at, video_url,
            //     processed_at, transcription_text, transcription_summary,
            //     transcription_analysis, transcription_cassification, thumbnail_url
            //   )
            //   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            //   ON CONFLICT (video_url) DO UPDATE SET
            //     channel_id = EXCLUDED.channel_id,
            //     channel_name = EXCLUDED.channel_name,
            //     video_title = EXCLUDED.video_title,
            //     posted_at = EXCLUDED.posted_at,
            //     processed_at = EXCLUDED.processed_at,
            //     transcription_text = EXCLUDED.transcription_text,
            //     transcription_summary = EXCLUDED.transcription_summary,
            //     transcription_analysis = EXCLUDED.transcription_analysis,
            //     transcription_cassification = EXCLUDED.transcription_cassification,
            //     thumbnail_url = EXCLUDED.thumbnail_url
            //   RETURNING (xmax = 0) AS inserted
            //   `,
            //   [
            //     transcription.channel_id,
            //     transcription.channel_name,
            //     transcription.video_title,
            //     postedAt,
            //     transcription.video_url,
            //     processedAt,
            //     transcription.transcription_text,
            //     transcription.transcription_summary || null,
            //     transcription.transcription_analysis || null,
            //     transcription.transcription_cassification || null,
            //     transcription.thumbnail_url || null,
            //   ],
            // );

            // if (result.rows[0].inserted) {
            //   this.stats.youtubeTranscriptions.inserted++;
            // } else {
            //   this.stats.youtubeTranscriptions.updated++;
            // }

            if ((i + 1) % 50 === 0) {
              console.log(`  Progress: ${i + 1}/${transcriptions.length}`);
            }
          } catch (err) {
            console.error(
              `  Error migrating transcription ${transcription.video_url}:`,
              err.message,
            );
            this.stats.youtubeTranscriptions.errors++;
          }
        }

        await client.query('COMMIT');
        console.log(
          `✓ YouTube Transcriptions migration complete: ${this.stats.youtubeTranscriptions.inserted} inserted, ${this.stats.youtubeTranscriptions.updated} updated, ${this.stats.youtubeTranscriptions.errors} errors`,
        );
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('Error migrating youtube transcriptions:', err);
      throw err;
    }
  }

  async close(): Promise<void> {
    if (this.sqliteDb) {
      await new Promise<void>((resolve, reject) => {
        this.sqliteDb!.close((err) => {
          if (err) {
            reject(err);
          } else {
            console.log('\n✓ SQLite connection closed');
            resolve();
          }
        });
      });
    }

    if (this.pgPool) {
      await this.pgPool.end();
      console.log('✓ PostgreSQL connection closed');
    }
  }

  printSummary(): void {
    console.log('\n' + '='.repeat(60));
    console.log('MIGRATION SUMMARY');
    console.log('='.repeat(60));

    const tables = [
      { name: 'Articles', stats: this.stats.articles },
      { name: 'Briefings', stats: this.stats.briefings },
      { name: 'YouTube Transcriptions', stats: this.stats.youtubeTranscriptions },
    ];

    tables.forEach((table) => {
      console.log(`\n${table.name}:`);
      console.log(`  Inserted: ${table.stats.inserted}`);
      console.log(`  Updated:  ${table.stats.updated}`);
      console.log(`  Errors:   ${table.stats.errors}`);
      console.log(`  Total:    ${table.stats.inserted + table.stats.updated}`);
    });

    const totalInserted =
      this.stats.articles.inserted +
      this.stats.briefings.inserted +
      this.stats.youtubeTranscriptions.inserted;
    const totalUpdated =
      this.stats.articles.updated +
      this.stats.briefings.updated +
      this.stats.youtubeTranscriptions.updated;
    const totalErrors =
      this.stats.articles.errors +
      this.stats.briefings.errors +
      this.stats.youtubeTranscriptions.errors;

    console.log('\n' + '-'.repeat(60));
    console.log(`Total Records Inserted: ${totalInserted}`);
    console.log(`Total Records Updated:  ${totalUpdated}`);
    console.log(`Total Errors:           ${totalErrors}`);
    console.log('='.repeat(60) + '\n');
  }
}

async function main(): Promise<void> {
  console.log('\n🔄 SQLite to PostgreSQL Migration Tool');
  console.log(`Started: ${new Date().toISOString()}\n`);
  console.log('='.repeat(60));

  const migration = new MigrationService();

  try {
    // Connect to both databases
    console.log('Connecting to databases...');
    await migration.connectSQLite();
    await migration.connectPostgreSQL();
    console.log('');

    // Run migrations in order
    // await migration.migrateArticles();
    // await migration.migrateBriefings();
    await migration.migrateYoutubeTranscriptions();

    // Print summary
    migration.printSummary();

    console.log(`✓ Migration completed successfully at ${new Date().toISOString()}`);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await migration.close();
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});

