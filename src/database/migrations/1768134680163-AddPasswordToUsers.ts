import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPasswordToUsers1768134680163 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE users
            ADD COLUMN password VARCHAR(255)
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE users
            DROP COLUMN password
        `);
  }

}
