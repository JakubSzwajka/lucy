import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateAgentModelDescriptionChannelPrompt1719475656928
  implements MigrationInterface
{
  name = 'UpdateAgentModelDescriptionChannelPrompt1719475656928';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agent" ADD "description" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent" ADD "defaultPrompt" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent" ADD "prefferedChannel" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agent" DROP COLUMN "prefferedChannel"`,
    );
    await queryRunner.query(`ALTER TABLE "agent" DROP COLUMN "defaultPrompt"`);
    await queryRunner.query(`ALTER TABLE "agent" DROP COLUMN "description"`);
  }
}
