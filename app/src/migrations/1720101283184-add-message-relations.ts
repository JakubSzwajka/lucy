import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMessageRelations1720101283184 implements MigrationInterface {
    name = 'AddMessageRelations1720101283184'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "skill" DROP CONSTRAINT "FK_7d4fb6af107e507d9a86293cf9d"`);
        await queryRunner.query(`ALTER TABLE "agent" DROP CONSTRAINT "FK_bd023b044232bc5e4f21b8e94cf"`);
        await queryRunner.query(`ALTER TABLE "skill" DROP COLUMN "agentId"`);
        await queryRunner.query(`ALTER TABLE "message" DROP COLUMN "human"`);
        await queryRunner.query(`ALTER TABLE "message" DROP COLUMN "agent"`);
        await queryRunner.query(`ALTER TABLE "agent" DROP CONSTRAINT "UQ_bd023b044232bc5e4f21b8e94cf"`);
        await queryRunner.query(`ALTER TABLE "agent" DROP COLUMN "ownerId"`);
        await queryRunner.query(`ALTER TABLE "message" ADD "humanMessage" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "message" ADD "agentMessage" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "message" ADD "agentId" uuid`);
        await queryRunner.query(`ALTER TABLE "message" ADD "userId" uuid`);
        await queryRunner.query(`ALTER TABLE "agent" ADD "ownerId" uuid`);
        await queryRunner.query(`ALTER TABLE "agent" ADD CONSTRAINT "UQ_bd023b044232bc5e4f21b8e94cf" UNIQUE ("ownerId")`);
        await queryRunner.query(`ALTER TABLE "skill" ADD "agentId" uuid`);
        await queryRunner.query(`ALTER TABLE "message" ADD CONSTRAINT "FK_640c87a856a4ab1937c8628cf71" FOREIGN KEY ("agentId") REFERENCES "agent"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "message" ADD CONSTRAINT "FK_446251f8ceb2132af01b68eb593" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "agent" ADD CONSTRAINT "FK_bd023b044232bc5e4f21b8e94cf" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "skill" ADD CONSTRAINT "FK_7d4fb6af107e507d9a86293cf9d" FOREIGN KEY ("agentId") REFERENCES "agent"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "skill" DROP CONSTRAINT "FK_7d4fb6af107e507d9a86293cf9d"`);
        await queryRunner.query(`ALTER TABLE "agent" DROP CONSTRAINT "FK_bd023b044232bc5e4f21b8e94cf"`);
        await queryRunner.query(`ALTER TABLE "message" DROP CONSTRAINT "FK_446251f8ceb2132af01b68eb593"`);
        await queryRunner.query(`ALTER TABLE "message" DROP CONSTRAINT "FK_640c87a856a4ab1937c8628cf71"`);
        await queryRunner.query(`ALTER TABLE "skill" DROP COLUMN "agentId"`);
        await queryRunner.query(`ALTER TABLE "agent" DROP CONSTRAINT "UQ_bd023b044232bc5e4f21b8e94cf"`);
        await queryRunner.query(`ALTER TABLE "agent" DROP COLUMN "ownerId"`);
        await queryRunner.query(`ALTER TABLE "message" DROP COLUMN "userId"`);
        await queryRunner.query(`ALTER TABLE "message" DROP COLUMN "agentId"`);
        await queryRunner.query(`ALTER TABLE "message" DROP COLUMN "agentMessage"`);
        await queryRunner.query(`ALTER TABLE "message" DROP COLUMN "humanMessage"`);
        await queryRunner.query(`ALTER TABLE "agent" ADD "ownerId" uuid`);
        await queryRunner.query(`ALTER TABLE "agent" ADD CONSTRAINT "UQ_bd023b044232bc5e4f21b8e94cf" UNIQUE ("ownerId")`);
        await queryRunner.query(`ALTER TABLE "message" ADD "agent" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "message" ADD "human" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "skill" ADD "agentId" uuid`);
        await queryRunner.query(`ALTER TABLE "agent" ADD CONSTRAINT "FK_bd023b044232bc5e4f21b8e94cf" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "skill" ADD CONSTRAINT "FK_7d4fb6af107e507d9a86293cf9d" FOREIGN KEY ("agentId") REFERENCES "agent"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
