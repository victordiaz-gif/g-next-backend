import {MigrationInterface, QueryRunner} from "typeorm";

export class MarketplacePaymentPlugin1755467528803 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "public"."IDX_seller_order_parent_order_id"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_seller_order_seller_id"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_ledger_entry_seller_id"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_ledger_entry_type"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_vendor_payout_seller_id"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_vendor_payout_status"`, undefined);
   }

   public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE INDEX "IDX_vendor_payout_status" ON "vendor_payout" ("status") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_vendor_payout_seller_id" ON "vendor_payout" ("sellerId") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_ledger_entry_type" ON "ledger_entry" ("type") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_ledger_entry_seller_id" ON "ledger_entry" ("sellerId") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_seller_order_seller_id" ON "seller_order" ("sellerId") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_seller_order_parent_order_id" ON "seller_order" ("parentOrderId") `, undefined);
   }

}
