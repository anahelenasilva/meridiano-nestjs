import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { FeedProfile } from '../shared/types/feed';
import {
  BriefsMetadata,
  GetBriefByIdResult,
  ProcessingStatsResult,
} from '../briefing/briefing.entity';

interface BriefingRow {
  id: number;
  generated_at: string;
  feed_profile: string;
  brief_markdown?: string;
}

interface CountRow {
  count: number;
}

interface AvgRow {
  avg: number | null;
}

@Injectable()
export class BriefingsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async saveBrief(
    content: string,
    articleIds: number[],
    feedProfile: FeedProfile,
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      const stmt = db.prepare(`
        INSERT INTO briefings (content, article_ids, feed_profile)
        VALUES (?, ?, ?)
      `);

      stmt.run(
        [content, JSON.stringify(articleIds), feedProfile],
        function (this: { lastID?: number }, err: Error | null) {
          if (err) {
            reject(err);
          } else {
            resolve(this.lastID ?? 0);
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

  async getBriefById(briefId: number): Promise<GetBriefByIdResult | null> {
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

  async getStats(feedProfile: FeedProfile): Promise<ProcessingStatsResult> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      const queries = [
        'SELECT COUNT(*) as count FROM articles WHERE feed_profile = ?',
        'SELECT COUNT(*) as count FROM articles WHERE feed_profile = ? AND processed_content IS NOT NULL',
        'SELECT COUNT(*) as count FROM articles WHERE feed_profile = ? AND impact_rating IS NOT NULL',
        'SELECT AVG(impact_rating) as avg FROM articles WHERE feed_profile = ? AND impact_rating IS NOT NULL',
      ];

      const results: (CountRow | AvgRow)[] = [];
      let completed = 0;

      queries.forEach((query, index) => {
        if (index === 3) {
          db.get(query, [feedProfile], (err, row: AvgRow | undefined) => {
            if (err) {
              reject(err);
              return;
            }

            results[index] = row || { avg: null };
            completed++;

            if (completed === queries.length) {
              const total = (results[0] as CountRow).count;
              const processed = (results[1] as CountRow).count;
              const rated = (results[2] as CountRow).count;
              const averageRating = (results[3] as AvgRow).avg;

              const stats: ProcessingStatsResult = {
                total,
                processed,
                rated,
                unprocessed: total - processed,
                unrated: processed - rated,
                averageRating: averageRating
                  ? Math.round(averageRating * 100) / 100
                  : undefined,
              };
              resolve(stats);
            }
          });
        } else {
          db.get(query, [feedProfile], (err, row: CountRow | undefined) => {
            if (err) {
              reject(err);
              return;
            }

            results[index] = row || { count: 0 };
            completed++;

            if (completed === queries.length) {
              const total = (results[0] as CountRow).count;
              const processed = (results[1] as CountRow).count;
              const rated = (results[2] as CountRow).count;
              const averageRating = (results[3] as AvgRow).avg;

              const stats: ProcessingStatsResult = {
                total,
                processed,
                rated,
                unprocessed: total - processed,
                unrated: processed - rated,
                averageRating: averageRating
                  ? Math.round(averageRating * 100) / 100
                  : undefined,
              };
              resolve(stats);
            }
          });
        }
      });
    });
  }
}
