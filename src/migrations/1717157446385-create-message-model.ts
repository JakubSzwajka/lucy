import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateMessageModel1717157446385 implements MigrationInterface {
    name = 'CreateMessageModel1717157446385'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`message\` (\`id\` varchar(36) NOT NULL, \`source\` varchar(255) NOT NULL, \`conversationId\` varchar(255) NOT NULL, \`human\` varchar(255) NOT NULL, \`agent\` varchar(255) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE \`message\``);
    }

}
