import gql from 'graphql-tag';
import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { RequestContext, Ctx, OrderService, ActiveOrderService, TransactionalConnection } from '@vendure/core';

@Resolver()
export class MarketplaceShopResolver {
  constructor(
    private orderService: OrderService,
    private activeOrderService: ActiveOrderService,
    private connection: TransactionalConnection,
  ) {}

  @Mutation()
  async addItemToOrderWithSeller(
    @Args('productVariantId') productVariantId: string,
    @Args('quantity') quantity: number,
    @Args('sellerChannelId', { nullable: true }) sellerChannelId: string | null,
    @Args('sellerChannelCode', { nullable: true }) sellerChannelCode: string | null,
    @Ctx() ctx: RequestContext
  ) {
    // Get or create active order
    const order = await this.activeOrderService.getActiveOrder(ctx, undefined, true);
    if (!order) {
      throw new Error('Failed to determine active order');
    }

    // Resolve sellerChannelId by code if needed
    let selectedSellerChannelId = sellerChannelId ?? undefined;
    if (!selectedSellerChannelId && sellerChannelCode) {
      const channelRepo = this.connection.getRepository(ctx, 'Channel');
      const channel = await channelRepo.findOne({ where: { code: sellerChannelCode } } as any);
      if (channel) {
        selectedSellerChannelId = String((channel as any).id);
      }
    }

    // Add item to order with custom fields for seller channel (id + code for admin display)
    const customFields: any = {};
    if (selectedSellerChannelId) customFields.selectedSellerChannelId = selectedSellerChannelId;
    if (sellerChannelCode) customFields.sellerChannelCode = sellerChannelCode;

    const result = await this.orderService.addItemToOrder(
      ctx,
      order.id,
      productVariantId,
      quantity,
      customFields
    );

    return result;
  }
}

export const shopApiExtensions = {
  schema: gql`
    extend type Mutation {
      addItemToOrderWithSeller(
        productVariantId: ID!
        quantity: Int!
        sellerChannelId: ID
        sellerChannelCode: String
      ): Order!
    }
  `,
  resolvers: [MarketplaceShopResolver],
};
