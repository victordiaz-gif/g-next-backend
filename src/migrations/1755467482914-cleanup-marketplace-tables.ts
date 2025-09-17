import {MigrationInterface, QueryRunner} from "typeorm";

export class CleanupMarketplaceTables1755467482914 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "order_line" DROP COLUMN "customFields"`, undefined);
        await queryRunner.query(`ALTER TABLE "search_index_item" DROP COLUMN "inStock"`, undefined);
        await queryRunner.query(`ALTER TABLE "search_index_item" DROP COLUMN "productInStock"`, undefined);
   }

   public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "search_index_item" ADD "productInStock" boolean NOT NULL DEFAULT true`, undefined);
        await queryRunner.query(`ALTER TABLE "search_index_item" ADD "inStock" boolean NOT NULL DEFAULT true`, undefined);
        await queryRunner.query(`ALTER TABLE "order_line" ADD "customFields" jsonb DEFAULT '{}'`, undefined);
   }

}
