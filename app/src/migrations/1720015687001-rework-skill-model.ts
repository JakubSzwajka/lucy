import { MigrationInterface, QueryRunner } from "typeorm";

export class ReworkSkillModel1720015687001 implements MigrationInterface {
    name = 'ReworkSkillModel1720015687001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "skill" DROP CONSTRAINT "UQ_0f49a593960360f6f85b692aca8"`);
        await queryRunner.query(`ALTER TABLE "skill" DROP COLUMN "name"`);
        await queryRunner.query(`ALTER TABLE "skill" DROP COLUMN "description"`);
        await queryRunner.query(`ALTER TABLE "skill" DROP COLUMN "parameters"`);
        await queryRunner.query(`ALTER TABLE "skill" ADD "skillId" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "skill" ADD CONSTRAINT "UQ_c8d3505ed7696ec1cc12ba1fe05" UNIQUE ("skillId")`);
        await queryRunner.query(`ALTER TABLE "skill" ADD "active" boolean NOT NULL`);
        await queryRunner.query(`ALTER TABLE "skill" ADD "agentId" uuid`);
        await queryRunner.query(`ALTER TABLE "skill" ADD CONSTRAINT "FK_7d4fb6af107e507d9a86293cf9d" FOREIGN KEY ("agentId") REFERENCES "agent"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "skill" DROP CONSTRAINT "FK_7d4fb6af107e507d9a86293cf9d"`);
        await queryRunner.query(`ALTER TABLE "skill" DROP COLUMN "agentId"`);
        await queryRunner.query(`ALTER TABLE "skill" DROP COLUMN "active"`);
        await queryRunner.query(`ALTER TABLE "skill" DROP CONSTRAINT "UQ_c8d3505ed7696ec1cc12ba1fe05"`);
        await queryRunner.query(`ALTER TABLE "skill" DROP COLUMN "skillId"`);
        await queryRunner.query(`ALTER TABLE "skill" ADD "parameters" text NOT NULL`);
        await queryRunner.query(`ALTER TABLE "skill" ADD "description" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "skill" ADD "name" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "skill" ADD CONSTRAINT "UQ_0f49a593960360f6f85b692aca8" UNIQUE ("name")`);
    }

}
