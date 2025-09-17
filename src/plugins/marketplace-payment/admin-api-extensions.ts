import gql from 'graphql-tag';
import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { RequestContext, Ctx, TransactionalConnection, Allow, Permission } from '@vendure/core';
import { MarketplacePayoutsService } from './marketplace-payouts.service';
import { SellerOrder, LedgerEntry, VendorPayout } from './entities';

@Resolver()
export class MarketplacePaymentResolver {
  constructor(
    private payoutsService: MarketplacePayoutsService,
  ) {}

  @Query()
  async sellerBalance(@Args('sellerId') sellerId: string, @Ctx() ctx: RequestContext): Promise<number> {
    return this.payoutsService.getSellerBalance(ctx, sellerId);
  }

  @Query()
  async sellerLedger(@Args('sellerId') sellerId: string, @Ctx() ctx: RequestContext): Promise<any[]> {
    return this.payoutsService.getSellerLedger(ctx, sellerId);
  }

  @Query()
  async sellerPayouts(@Args('sellerId') sellerId: string, @Ctx() ctx: RequestContext): Promise<any[]> {
    return this.payoutsService.getSellerPayouts(ctx, sellerId);
  }

  @Query()
  async pendingPayouts(@Ctx() ctx: RequestContext): Promise<any[]> {
    return this.payoutsService.getPendingPayouts(ctx);
  }

  @Mutation()
  async createVendorPayout(
    @Args('sellerId') sellerId: string,
    @Args('amount') amount: number,
    @Args('sellerName') sellerName: string,
    @Args('notes') notes: string,
    @Ctx() ctx: RequestContext
  ): Promise<any> {
    return this.payoutsService.createManualPayout(ctx, sellerId, amount, sellerName, notes);
  }

  @Mutation()
  async markPayoutCompleted(
    @Args('payoutId') payoutId: string,
    @Args('externalId') externalId: string,
    @Ctx() ctx: RequestContext
  ): Promise<any> {
    return this.payoutsService.markPayoutCompleted(ctx, payoutId, externalId);
  }
}

export const adminApiExtensions = {
  schema: gql`
    extend type Query {
      sellerBalance(sellerId: ID!): Int
      sellerLedger(sellerId: ID!): [LedgerEntry!]!
      sellerPayouts(sellerId: ID!): [VendorPayout!]!
      pendingPayouts: [VendorPayout!]!
    }
    
    extend type Mutation {
      createVendorPayout(sellerId: ID!, amount: Int!, sellerName: String!, notes: String!): VendorPayout!
      markPayoutCompleted(payoutId: ID!, externalId: String!): VendorPayout!
    }
    
    type LedgerEntry {
      id: ID!
      sellerId: String
      sellerName: String
      sellerOrderId: String
      type: String!
      amountWithTax: Int!
      reference: String
      description: String
      createdAt: String!
    }
    
    type VendorPayout {
      id: ID!
      sellerId: String!
      sellerName: String
      amount: Int!
      status: String!
      externalId: String
      notes: String
      createdAt: String!
    }
  `,
  resolvers: [MarketplacePaymentResolver],
};
