import { Category } from './category';

export interface CategoryRow {
  id: string;
  name: string;
  color: string;
  created_at: string | Date;
  updated_at: string | Date;
}

export function mapCategoryRow(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}
