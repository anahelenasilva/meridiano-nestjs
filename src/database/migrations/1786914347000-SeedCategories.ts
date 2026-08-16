import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedCategories1786914347000 implements MigrationInterface {
  name = 'SeedCategories1786914347000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO categories (name, color)
      VALUES
        ('tech', '#3b82f6'),
        ('travel', '#10b981'),
        ('AI', '#8b5cf6')
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM categories WHERE LOWER(name) IN ('tech', 'travel', 'ai')
    `);
  }
}
