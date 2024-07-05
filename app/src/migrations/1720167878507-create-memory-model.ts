import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateMemoryModel1720167878507 implements MigrationInterface {
    name = 'CreateMemoryModel1720167878507'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "memory" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "text" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" uuid, CONSTRAINT "PK_719a982d08209b92cd1a0b1c4ec" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "memory" ADD CONSTRAINT "FK_fc71562e9a53841973da0dde326" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "memory" DROP CONSTRAINT "FK_fc71562e9a53841973da0dde326"`);
        await queryRunner.query(`DROP TABLE "memory"`);
    }

}
