import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { Ctx, RequestContext, OrderService, ActiveOrderService, TransactionalConnection } from '@vendure/core';

@Resolver()
export class AddItemWithSellerResolver {
  constructor(
    private activeOrderService: ActiveOrderService,
    private orderService: OrderService,
    private connection: TransactionalConnection,
  ) {}

  /**
   * Mutation to add item to order with explicit seller channel selection
   * This allows the storefront to specify which seller channel to use for the order line
   */
  @Mutation()
  async addItemToOrderWithSeller(
    @Args('productVariantId') productVariantId: string,
    @Args('quantity') quantity: number,
    @Args('sellerChannelId', { nullable: true }) sellerChannelId: string | null,
    @Args('sellerChannelCode', { nullable: true }) sellerChannelCode: string | null,
    @Ctx() ctx: RequestContext,
  ) {
    // Ensure an active order exists (creates if necessary)
    const order = await this.activeOrderService.getActiveOrder(ctx, undefined, true);

    if (!order) {
      throw new Error('Failed to determine active order');
    }

    // Resolve sellerChannelId from code if not provided
    let resolvedChannelId = sellerChannelId ?? undefined;
    if (!resolvedChannelId && sellerChannelCode) {
      const channelRepo = this.connection.getRepository(ctx, 'Channel');
      const channel = await channelRepo.findOne({ where: { code: sellerChannelCode } } as any);
      if (channel) {
        resolvedChannelId = String((channel as any).id);
      }
    }

    // Build customFields object for the OrderLine using the configured field names
    const customFields = (resolvedChannelId || sellerChannelCode)
      ? {
          selectedSellerChannelId: resolvedChannelId ?? null,
          sellerChannelCode: sellerChannelCode ?? null,
        }
      : undefined;

    // Call the core OrderService.addItemToOrder which will:
    // - create / increment the OrderLine
    // - internally call any registered OrderSellerStrategy.setOrderLineSellerChannel(...)
    // - The MultivendorSellerStrategy will use the sellerChannelId if provided
    const result = await this.orderService.addItemToOrder(
      ctx,
      order.id,
      productVariantId,
      quantity,
      customFields,
    );

    return result;
  }
}
