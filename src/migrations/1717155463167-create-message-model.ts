import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMessageModel1717155463167 implements MigrationInterface {
  name = 'CreateMessageModel1717155463167';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "message" ("id" varchar PRIMARY KEY NOT NULL, "source" text NOT NULL DEFAULT ('slack'), "conversationId" varchar NOT NULL, "human" varchar NOT NULL, "agent" varchar NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "message"`);
  }
}
