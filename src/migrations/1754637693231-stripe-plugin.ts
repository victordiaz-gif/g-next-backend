import {MigrationInterface, QueryRunner} from "typeorm";

export class StripePlugin1754637693231 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "customer" ADD "customFieldsStripecustomerid" character varying(255)`, undefined);
   }

   public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "customer" DROP COLUMN "customFieldsStripecustomerid"`, undefined);
   }

}
