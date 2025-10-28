import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAgencyCustomFieldsToSeller1758224000000 implements MigrationInterface {
    name = 'AddAgencyCustomFieldsToSeller1758224000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add agency custom fields to seller table
        await queryRunner.query(`ALTER TABLE "seller" ADD "customFieldsAgencyid" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "seller" ADD "customFieldsAgencyname" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "seller" ADD "customFieldsAgencycode" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "seller" ADD "customFieldsAgencyemail" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "seller" ADD "customFieldsAgencyphone" character varying(255)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove agency custom fields from seller table
        await queryRunner.query(`ALTER TABLE "seller" DROP COLUMN "customFieldsAgencyphone"`);
        await queryRunner.query(`ALTER TABLE "seller" DROP COLUMN "customFieldsAgencyemail"`);
        await queryRunner.query(`ALTER TABLE "seller" DROP COLUMN "customFieldsAgencycode"`);
        await queryRunner.query(`ALTER TABLE "seller" DROP COLUMN "customFieldsAgencyname"`);
        await queryRunner.query(`ALTER TABLE "seller" DROP COLUMN "customFieldsAgencyid"`);
    }
}

