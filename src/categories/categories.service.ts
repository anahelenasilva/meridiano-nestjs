import { DatabaseService } from '@libs/database';
import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Category, CategoryWithChannelCount } from './domain/category';

function isUniqueViolation(err: Error): boolean {
  const withCode = err as Error & { code?: string };
  return (
    withCode.code === '23505' ||
    err.message.includes('duplicate key value') ||
    err.message.includes('UNIQUE constraint')
  );
}

function mapRow(row: any): Category {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

@Injectable()
export class CategoriesService {
  constructor(private readonly databaseService: DatabaseService) {}

  async listCategories(): Promise<CategoryWithChannelCount[]> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      db.all(
        `
        SELECT
          c.id,
          c.name,
          c.color,
          c.created_at,
          c.updated_at,
          COUNT(cc.channel_id) AS channel_count
        FROM categories c
        LEFT JOIN channel_categories cc ON cc.category_id = c.id
        GROUP BY c.id
        ORDER BY LOWER(c.name)
        `,
        [],
        (err: Error | null, rows?: any[]) => {
          if (err) {
            reject(err);
            return;
          }

          resolve(
            (rows ?? []).map((row) => ({
              ...mapRow(row),
              channelCount: Number(row.channel_count),
            })),
          );
        },
      );
    });
  }

  async getUsedColors(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      db.all(
        'SELECT DISTINCT color FROM categories',
        [],
        (err: Error | null, rows?: any[]) => {
          if (err) {
            reject(err);
            return;
          }

          resolve((rows ?? []).map((row) => row.color));
        },
      );
    });
  }

  async createCategory(name: string, color: string): Promise<Category> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      db.get(
        `
        INSERT INTO categories (name, color)
        VALUES (?, ?)
        RETURNING id, name, color, created_at, updated_at
        `,
        [name, color],
        (err: Error | null, row?: any) => {
          if (err) {
            reject(
              isUniqueViolation(err)
                ? new ConflictException(
                    `A category named "${name}" already exists`,
                  )
                : new InternalServerErrorException('Failed to create category'),
            );
            return;
          }

          resolve(mapRow(row));
        },
      );
    });
  }

  async renameCategory(id: string, name: string): Promise<Category> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      db.get(
        `
        UPDATE categories
        SET name = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        RETURNING id, name, color, created_at, updated_at
        `,
        [name, id],
        (err: Error | null, row?: any) => {
          if (err) {
            reject(
              isUniqueViolation(err)
                ? new ConflictException(
                    `A category named "${name}" already exists`,
                  )
                : new InternalServerErrorException('Failed to rename category'),
            );
            return;
          }

          if (!row) {
            reject(new NotFoundException(`Category ${id} not found`));
            return;
          }

          resolve(mapRow(row));
        },
      );
    });
  }

  async deleteCategory(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      db.run(
        'DELETE FROM categories WHERE id = ?',
        [id],
        function (err: Error | null) {
          if (err) {
            reject(
              new InternalServerErrorException('Failed to delete category'),
            );
            return;
          }

          if (this.changes === 0) {
            reject(new NotFoundException(`Category ${id} not found`));
            return;
          }

          resolve();
        },
      );
    });
  }
}
