import { MigrationInterface, QueryRunner } from "typeorm";

export class ReworkAgentUserRelation1720100762741 implements MigrationInterface {
    name = 'ReworkAgentUserRelation1720100762741'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_b61c694cacfab25533bd23d9add"`);
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "UQ_b61c694cacfab25533bd23d9add"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "agentId"`);
        await queryRunner.query(`ALTER TABLE "agent" ADD "ownerId" uuid`);
        await queryRunner.query(`ALTER TABLE "agent" ADD CONSTRAINT "UQ_bd023b044232bc5e4f21b8e94cf" UNIQUE ("ownerId")`);
        await queryRunner.query(`ALTER TABLE "agent" ADD CONSTRAINT "FK_bd023b044232bc5e4f21b8e94cf" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "agent" DROP CONSTRAINT "FK_bd023b044232bc5e4f21b8e94cf"`);
        await queryRunner.query(`ALTER TABLE "agent" DROP CONSTRAINT "UQ_bd023b044232bc5e4f21b8e94cf"`);
        await queryRunner.query(`ALTER TABLE "agent" DROP COLUMN "ownerId"`);
        await queryRunner.query(`ALTER TABLE "user" ADD "agentId" uuid`);
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "UQ_b61c694cacfab25533bd23d9add" UNIQUE ("agentId")`);
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "FK_b61c694cacfab25533bd23d9add" FOREIGN KEY ("agentId") REFERENCES "agent"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
