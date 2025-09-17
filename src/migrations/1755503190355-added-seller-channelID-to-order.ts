import {MigrationInterface, QueryRunner} from "typeorm";

export class AddedSellerChannelIDToOrder1755503190355 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "order_line" ADD "customFieldsSelectedsellerchannelid" character varying(255)`, undefined);
   }

   public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "order_line" DROP COLUMN "customFieldsSelectedsellerchannelid"`, undefined);
   }

}
