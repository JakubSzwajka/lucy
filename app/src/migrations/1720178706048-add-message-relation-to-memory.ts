import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMessageRelationToMemory1720178706048 implements MigrationInterface {
    name = 'AddMessageRelationToMemory1720178706048'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "memory_messages_message" ("memoryId" uuid NOT NULL, "messageId" uuid NOT NULL, CONSTRAINT "PK_41175d11e03cc0a38b5cba39d16" PRIMARY KEY ("memoryId", "messageId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a275eef8fa9acc7720f58fe219" ON "memory_messages_message" ("memoryId") `);
        await queryRunner.query(`CREATE INDEX "IDX_20e02ce37a534a6cbe07021e62" ON "memory_messages_message" ("messageId") `);
        await queryRunner.query(`ALTER TABLE "memory_messages_message" ADD CONSTRAINT "FK_a275eef8fa9acc7720f58fe2195" FOREIGN KEY ("memoryId") REFERENCES "memory"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "memory_messages_message" ADD CONSTRAINT "FK_20e02ce37a534a6cbe07021e626" FOREIGN KEY ("messageId") REFERENCES "message"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "memory_messages_message" DROP CONSTRAINT "FK_20e02ce37a534a6cbe07021e626"`);
        await queryRunner.query(`ALTER TABLE "memory_messages_message" DROP CONSTRAINT "FK_a275eef8fa9acc7720f58fe2195"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_20e02ce37a534a6cbe07021e62"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a275eef8fa9acc7720f58fe219"`);
        await queryRunner.query(`DROP TABLE "memory_messages_message"`);
    }

}
