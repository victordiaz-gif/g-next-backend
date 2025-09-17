import {MigrationInterface, QueryRunner} from "typeorm";

export class AddedOrderSellerChannelCode1755507653934 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "order_line" ADD "customFieldsSellerchannelcode" character varying(255)`, undefined);
   }

   public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "order_line" DROP COLUMN "customFieldsSellerchannelcode"`, undefined);
   }

}
