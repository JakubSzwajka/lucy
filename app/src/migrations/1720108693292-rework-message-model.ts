import { MigrationInterface, QueryRunner } from "typeorm";

export class ReworkMessageModel1720108693292 implements MigrationInterface {
    name = 'ReworkMessageModel1720108693292'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "message" DROP COLUMN "humanMessage"`);
        await queryRunner.query(`ALTER TABLE "message" DROP COLUMN "agentMessage"`);
        await queryRunner.query(`ALTER TABLE "message" ADD "type" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "message" ADD "text" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "agent" ADD "retrieveKnowledgePrompt" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "agent" DROP COLUMN "retrieveKnowledgePrompt"`);
        await queryRunner.query(`ALTER TABLE "message" DROP COLUMN "text"`);
        await queryRunner.query(`ALTER TABLE "message" DROP COLUMN "type"`);
        await queryRunner.query(`ALTER TABLE "message" ADD "agentMessage" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "message" ADD "humanMessage" character varying NOT NULL`);
    }

}
