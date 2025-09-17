import { VendurePlugin, PluginCommonModule } from '@vendure/core';
import { MarketplacePaymentSubscriber } from './marketplace-payment.subscriber';
import { MarketplacePayoutsService } from './marketplace-payouts.service';
import { RefundsSubscriber } from './refunds.subscriber';
import { ShippingFixSubscriber } from './shipping-fix.subscriber';
import { adminApiExtensions, MarketplacePaymentResolver } from './admin-api-extensions';
import { shopApiExtensions, MarketplaceShopResolver } from './shop-api-extensions';
import { SellerOrder, LedgerEntry, VendorPayout } from './entities';
import { MarketplacePaymentPluginOptions } from './types';
import { ProductSellersService } from '../product-sellers/product-sellers.service';

@VendurePlugin({
  imports: [PluginCommonModule],
  entities: [SellerOrder as any, LedgerEntry as any, VendorPayout as any],
    providers: [
    MarketplacePaymentSubscriber,
    MarketplacePayoutsService,
    RefundsSubscriber,
    ShippingFixSubscriber,
    ProductSellersService,
    {
      provide: 'MARKETPLACE_PAYMENT_PLUGIN_OPTIONS',
      useFactory: () => MarketplacePaymentPlugin.options,
    },
  ],
  adminApiExtensions: {
    schema: adminApiExtensions.schema,
    resolvers: [MarketplacePaymentResolver],
  },
  shopApiExtensions: {
    schema: shopApiExtensions.schema,
    resolvers: [MarketplaceShopResolver],
  },
  configuration: (config) => {
    // The marketplace payment plugin extends the existing multivendor functionality
    // We don't override the order seller strategy since the multivendor plugin already handles it
    return config;
  },
  compatibility: '^3.4.0',
})
export class MarketplacePaymentPlugin {
  static options: MarketplacePaymentPluginOptions;

  static init(options: MarketplacePaymentPluginOptions) {
    MarketplacePaymentPlugin.options = options;
    return MarketplacePaymentPlugin;
  }
}
