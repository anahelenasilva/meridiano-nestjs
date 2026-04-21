import { DatabaseService } from '@libs/database';
import { Injectable } from '@nestjs/common';
import { BriefsMetadata, GetBriefByIdResult } from './entities/briefing.entity';
import { FeedProfile } from '../shared/types/feed';

interface BriefingRow {
  id: string;
  generated_at: string;
  feed_profile: string;
  brief_markdown?: string;
}

@Injectable()
export class BriefingsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async saveBrief(
    content: string,
    articleIds: string[],
    feedProfile: FeedProfile,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      const stmt = db.prepare(`
        INSERT INTO briefings (content, article_ids, feed_profile)
        VALUES (?, ?, ?)
      `);

      stmt.run(
        [content, JSON.stringify(articleIds), feedProfile],
        function (this: { lastID?: string }, err: Error | null) {
          if (err) {
            reject(err);
          } else if (!this.lastID) {
            reject(new Error('saveBrief: insert succeeded but no lastID returned'));
          } else {
            resolve(this.lastID);
          }
          stmt.finalize();
        },
      );
    });
  }

  async getAllBriefsMetadata(
    feedProfile?: FeedProfile,
  ): Promise<BriefsMetadata[]> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      let query =
        'SELECT id, created_at as generated_at, feed_profile FROM briefings';
      const params: string[] = [];

      if (feedProfile) {
        query += ' WHERE feed_profile = ?';
        params.push(feedProfile);
      }

      query += ' ORDER BY created_at DESC';

      db.all(query, params, (err, rows: BriefingRow[]) => {
        if (err) {
          reject(err);
        } else {
          const briefings: BriefsMetadata[] = rows.map((row) => ({
            id: row.id,
            generated_at: new Date(row.generated_at),
            feed_profile: row.feed_profile,
          }));
          resolve(briefings);
        }
      });
    });
  }

  async getBriefById(briefId: string): Promise<GetBriefByIdResult | null> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      db.get(
        'SELECT id, content as brief_markdown, created_at as generated_at, feed_profile FROM briefings WHERE id = ?',
        [briefId],
        (err, row: BriefingRow | undefined) => {
          if (err) {
            reject(err);
          } else if (!row) {
            resolve(null);
          } else {
            const result: GetBriefByIdResult = {
              id: row.id,
              brief_markdown: row.brief_markdown || '',
              generated_at: new Date(row.generated_at),
              feed_profile: row.feed_profile,
            };
            resolve(result);
          }
        },
      );
    });
  }

}
