import { DatabaseService } from '@libs/database';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Category } from '../categories/domain/category';
import { mapCategoryRow } from '../categories/domain/map-category-row';

@Injectable()
export class ChannelCategoriesService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getCategoriesForChannel(channelId: string): Promise<Category[]> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      db.all(
        `
        SELECT c.id, c.name, c.color, c.created_at, c.updated_at
        FROM channel_categories cc
        JOIN categories c ON c.id = cc.category_id
        WHERE cc.channel_id = ?
        ORDER BY LOWER(c.name)
        `,
        [channelId],
        (err: Error | null, rows?: any[]) => {
          if (err) {
            reject(
              new InternalServerErrorException(
                'Failed to load channel categories',
              ),
            );
            return;
          }

          resolve((rows ?? []).map(mapCategoryRow));
        },
      );
    });
  }

  async getCategoriesForChannels(
    channelIds: string[],
  ): Promise<Map<string, Category[]>> {
    if (channelIds.length === 0) {
      return new Map();
    }

    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      db.all(
        `
        SELECT cc.channel_id, c.id, c.name, c.color, c.created_at, c.updated_at
        FROM channel_categories cc
        JOIN categories c ON c.id = cc.category_id
        WHERE cc.channel_id = ANY(?)
        ORDER BY LOWER(c.name)
        `,
        [channelIds],
        (err: Error | null, rows?: any[]) => {
          if (err) {
            reject(
              new InternalServerErrorException(
                'Failed to load channel categories',
              ),
            );
            return;
          }

          const byChannel = new Map<string, Category[]>();
          for (const row of rows ?? []) {
            const categories = byChannel.get(row.channel_id) ?? [];
            categories.push(mapCategoryRow(row));
            byChannel.set(row.channel_id, categories);
          }

          resolve(byChannel);
        },
      );
    });
  }

  // Replace-the-whole-set: diffs the submitted ids against the channel's
  // current assignments so the result is exactly what was submitted. Runs as
  // separate, non-transactional queries (DatabaseConnection has no
  // begin/commit) — matches this codebase's existing multi-step-write
  // convention (e.g. createChannel's insert-then-select), not a new gap.
  async replaceChannelCategories(
    channelId: string,
    categoryIds: string[],
  ): Promise<void> {
    const currentIds = await this.getCurrentCategoryIds(channelId);
    const currentSet = new Set(currentIds);
    const nextSet = new Set(categoryIds);

    const toRemove = currentIds.filter((id) => !nextSet.has(id));
    const toAdd = categoryIds.filter((id) => !currentSet.has(id));

    if (toRemove.length > 0) {
      await this.removeAssignments(channelId, toRemove);
    }

    if (toAdd.length > 0) {
      await this.addAssignments(channelId, toAdd);
    }
  }

  private async getCurrentCategoryIds(channelId: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      db.all(
        'SELECT category_id FROM channel_categories WHERE channel_id = ?',
        [channelId],
        (err: Error | null, rows?: { category_id: string }[]) => {
          if (err) {
            reject(
              new InternalServerErrorException(
                'Failed to load channel categories',
              ),
            );
            return;
          }

          resolve((rows ?? []).map((row) => row.category_id));
        },
      );
    });
  }

  private async removeAssignments(
    channelId: string,
    categoryIds: string[],
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      db.run(
        'DELETE FROM channel_categories WHERE channel_id = ? AND category_id = ANY(?)',
        [channelId, categoryIds],
        (err: Error | null) => {
          if (err) {
            reject(
              new InternalServerErrorException(
                'Failed to update channel categories',
              ),
            );
            return;
          }

          resolve();
        },
      );
    });
  }

  private async addAssignments(
    channelId: string,
    categoryIds: string[],
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      // Own RETURNING clause: channel_categories has no `id` column, so the
      // pg connection wrapper's auto-appended `RETURNING id` would 500 here.
      const placeholders = categoryIds.map(() => '(?, ?)').join(', ');
      const params = categoryIds.flatMap((categoryId) => [
        channelId,
        categoryId,
      ]);

      db.run(
        `
        INSERT INTO channel_categories (channel_id, category_id)
        VALUES ${placeholders}
        ON CONFLICT DO NOTHING
        RETURNING channel_id
        `,
        params,
        (err: Error | null) => {
          if (err) {
            reject(
              new InternalServerErrorException(
                'Failed to update channel categories',
              ),
            );
            return;
          }

          resolve();
        },
      );
    });
  }
}
