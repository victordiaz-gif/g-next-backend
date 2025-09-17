import { PluginCommonModule, Type, VendurePlugin } from "@vendure/core";
import { gql } from "graphql-tag";

import { PRODUCT_SELLERS_PLUGIN_OPTIONS } from "./constants";
import { PluginInitOptions } from "./types";
import { ProductSellersService } from "./product-sellers.service";
import { ProductOffersFieldResolver, ProductSellersResolver, SearchResultOffersFieldResolver } from "./product-sellers.resolver";

const schema = gql`
  type ProductSeller {
    channelId: ID!
    channelCode: String!
    sellerId: ID
    sellerName: String
  }
  
  extend type Query {
    productSellers(productId: ID!): [ProductSeller!]!
  }

  extend type Product {
    productSellers: [ProductSeller!]!
  }

  extend type SearchResult {
    productSellers: [ProductSeller!]!
  }
`;

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [
    {
      provide: PRODUCT_SELLERS_PLUGIN_OPTIONS,
      useFactory: () => ProductSellersPlugin.options,
    },
    ProductSellersService,
    ProductOffersFieldResolver,
    SearchResultOffersFieldResolver
  ],
  configuration: (config) => {
    // Plugin-specific configuration
    // such as custom fields, custom permissions,
    // strategies etc. can be configured here by
    // modifying the `config` object.
    return config;
  },
  shopApiExtensions: {
    schema,
    resolvers: [ProductSellersResolver, ProductOffersFieldResolver, SearchResultOffersFieldResolver],
  },
  compatibility: "^3.4.0",
})
export class ProductSellersPlugin {
  static options: PluginInitOptions;

  static init(options: PluginInitOptions): Type<ProductSellersPlugin> {
    this.options = options;
    return ProductSellersPlugin;
  }
}
