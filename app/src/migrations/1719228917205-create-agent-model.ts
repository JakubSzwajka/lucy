import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAgentModel1719228917205 implements MigrationInterface {
  name = 'CreateAgentModel1719228917205';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "agent" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, CONSTRAINT "PK_1000e989398c5d4ed585cf9a46f" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(`ALTER TABLE "user" ADD "agentId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "UQ_b61c694cacfab25533bd23d9add" UNIQUE ("agentId")`
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "FK_b61c694cacfab25533bd23d9add" FOREIGN KEY ("agentId") REFERENCES "agent"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" DROP CONSTRAINT "FK_b61c694cacfab25533bd23d9add"`
    );
    await queryRunner.query(
      `ALTER TABLE "user" DROP CONSTRAINT "UQ_b61c694cacfab25533bd23d9add"`
    );
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "agentId"`);
    await queryRunner.query(`DROP TABLE "agent"`);
  }
}
