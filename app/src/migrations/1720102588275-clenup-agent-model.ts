import { MigrationInterface, QueryRunner } from "typeorm";

export class ClenupAgentModel1720102588275 implements MigrationInterface {
    name = 'ClenupAgentModel1720102588275'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "skill" DROP CONSTRAINT "FK_7d4fb6af107e507d9a86293cf9d"`);
        await queryRunner.query(`ALTER TABLE "skill" DROP COLUMN "agentId"`);
        await queryRunner.query(`ALTER TABLE "agent" DROP COLUMN "description"`);
        await queryRunner.query(`ALTER TABLE "agent" DROP COLUMN "preferredChannel"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "agent" ADD "preferredChannel" character varying`);
        await queryRunner.query(`ALTER TABLE "agent" ADD "description" character varying`);
        await queryRunner.query(`ALTER TABLE "skill" ADD "agentId" uuid`);
        await queryRunner.query(`ALTER TABLE "skill" ADD CONSTRAINT "FK_7d4fb6af107e507d9a86293cf9d" FOREIGN KEY ("agentId") REFERENCES "agent"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
