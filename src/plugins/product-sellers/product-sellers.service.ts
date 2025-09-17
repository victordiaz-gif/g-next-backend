import { Injectable, Logger } from "@nestjs/common";
import { ID, TransactionalConnection, RequestContext } from "@vendure/core";

export type SimpleSeller = {
  channelId: string;
  channelCode?: string | null;
  sellerId: string;
  sellerName: string;
};

@Injectable()
export class ProductSellersService {
  private logger = new Logger("ProductSellersService");

  constructor(private connection: TransactionalConnection) {}

  async findSellers(ctx: RequestContext, productId: ID): Promise<SimpleSeller[]> {
    try {
      const productRepo = this.connection.getRepository(ctx, "Product");

      // Fetch product with its channels
      const product = await productRepo.findOne({
        where: { id: productId },
        relations: ["channels"], // Vendure 3.4.0: product.channels relation exists
      });

      if (!product || !product.channels || product.channels.length === 0) {
        return [];
      }

      // Map channels to SimpleSeller
      const sellers: SimpleSeller[] = product.channels.map((ch: any) => ({
        channelId: String(ch.id),
        channelCode: ch.code,
        sellerId: ch.seller
          ? String(ch.seller.id)
          : ch.customFields?.sellerId ?? null,
        sellerName: ch.seller?.name ?? ch.customFields?.sellerName ?? null,
      }));

      return sellers;
    } catch (err: any) {
      this.logger.error("Failed to fetch product sellers: " + err.message);
      return [];
    }
  }

   /**
   * Batch loader: fetch sellers for many productIds at once.
   * Returns Map(productId -> SimpleSeller[])
   */
   async getSellersForProductIds(ctx: RequestContext, productIds: ID[]) {
    const productRepo = this.connection.getRepository(ctx, 'Product');

    // Load products with their channels in one query (includes channels relation)
    const products = await productRepo.find({
      where: (qb: any) => {
        qb.whereInIds(productIds);
      },
      relations: ['channels', 'channels.seller', 'channels.customFields'],
    });

    // Build map productId -> sellers[]
    const sellersByProduct = new Map<string, SimpleSeller[]>();
    for (const prod of products) {
      const pid = String(prod.id);
      const sellers: SimpleSeller[] = (prod.channels || []).map((ch: any) => ({
        channelId: String(ch.id),
        channelCode: ch.code,
        sellerId: ch.seller ? String(ch.seller.id) : (ch.customFields?.sellerId ?? null),
        sellerName: ch.seller ? ch.seller.name : (ch.customFields?.sellerName ?? null),
      }));
      sellersByProduct.set(pid, sellers);
    }

    // Ensure every requested productId has an entry (empty array if no channels)
    for (const id of productIds) {
      if (!sellersByProduct.has(String(id))) sellersByProduct.set(String(id), []);
    }

    return sellersByProduct; // Map<string, SimpleSeller[]>
  }
}
