import { MigrationInterface, QueryRunner } from 'typeorm';

export class TypoFix1719476544293 implements MigrationInterface {
  name = 'TypoFix1719476544293';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agent" RENAME COLUMN "prefferedChannel" TO "preferredChannel"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agent" RENAME COLUMN "preferredChannel" TO "prefferedChannel"`,
    );
  }
}
