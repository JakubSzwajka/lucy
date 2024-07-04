import { MigrationInterface, QueryRunner } from "typeorm";

export class FixRelations1720104170322 implements MigrationInterface {
    name = 'FixRelations1720104170322'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "skill" ADD "agentId" uuid`);
        await queryRunner.query(`ALTER TABLE "skill" ADD CONSTRAINT "FK_7d4fb6af107e507d9a86293cf9d" FOREIGN KEY ("agentId") REFERENCES "agent"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "skill" DROP CONSTRAINT "FK_7d4fb6af107e507d9a86293cf9d"`);
        await queryRunner.query(`ALTER TABLE "skill" DROP COLUMN "agentId"`);
    }

}
