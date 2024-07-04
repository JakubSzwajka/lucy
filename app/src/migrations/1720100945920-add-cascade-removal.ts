import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCascadeRemoval1720100945920 implements MigrationInterface {
    name = 'AddCascadeRemoval1720100945920'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "skill" DROP CONSTRAINT "FK_7d4fb6af107e507d9a86293cf9d"`);
        await queryRunner.query(`ALTER TABLE "agent" DROP CONSTRAINT "FK_bd023b044232bc5e4f21b8e94cf"`);
        await queryRunner.query(`ALTER TABLE "skill" ADD CONSTRAINT "FK_7d4fb6af107e507d9a86293cf9d" FOREIGN KEY ("agentId") REFERENCES "agent"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "agent" ADD CONSTRAINT "FK_bd023b044232bc5e4f21b8e94cf" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "agent" DROP CONSTRAINT "FK_bd023b044232bc5e4f21b8e94cf"`);
        await queryRunner.query(`ALTER TABLE "skill" DROP CONSTRAINT "FK_7d4fb6af107e507d9a86293cf9d"`);
        await queryRunner.query(`ALTER TABLE "agent" ADD CONSTRAINT "FK_bd023b044232bc5e4f21b8e94cf" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "skill" ADD CONSTRAINT "FK_7d4fb6af107e507d9a86293cf9d" FOREIGN KEY ("agentId") REFERENCES "agent"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
