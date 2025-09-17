// src/plugins/product-sellers-plugin/product-sellers.resolver.ts
import { Resolver, Query, Args, Parent, ResolveField } from '@nestjs/graphql';
import { Ctx, RequestContext, ID } from '@vendure/core';
import { ProductSellersService } from './product-sellers.service';
import { getOrCreateSellersLoader } from './product-sellers.loader';

@Resolver()
export class ProductSellersResolver {
  constructor(private sellersService: ProductSellersService) {}

  @Query('productSellers')
  async productSellers(
    @Ctx() ctx: RequestContext,
    @Args('productId') productId: ID,
  ) {
    return this.sellersService.findSellers(ctx, productId);
  }
}

/**
 * Field resolver for Product.productSellers
 * This resolves the `productSellers` field on Product by using a per-request batch loader.
 */
@Resolver('Product')
export class ProductOffersFieldResolver {
  constructor(private sellersService: ProductSellersService) {}

  // resolves Product.productSellers
  @ResolveField('productSellers')
  async productSellers(@Parent() product: any, @Ctx() ctx: RequestContext) {
    // fallback: product.id or product.id as string
    const productId = String(product.id || product.identifier || product.productId);
    const loader = getOrCreateSellersLoader(ctx, this.sellersService);
    return loader.load(productId);
  }
}

/**
 * Field resolver for SearchResult.productSellers
 * This resolves the `productSellers` field on SearchResult by using a per-request batch loader.
 */
@Resolver('SearchResult')
export class SearchResultOffersFieldResolver {
  constructor(private sellersService: ProductSellersService) {}

  // resolves SearchResult.productSellers
  @ResolveField('productSellers')
  async productSellers(@Parent() searchResult: any, @Ctx() ctx: RequestContext) {
    // For search results, we need to extract the productId from the search result
    // The productId field is available in search results
    const productId = String(searchResult.productId);
    const loader = getOrCreateSellersLoader(ctx, this.sellersService);
    return loader.load(productId);
  }
}
