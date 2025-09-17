import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  TransactionalConnection,
  OrderPlacedEvent,
  RequestContext,
  OrderLine,
  Order,
  ChannelService,
  EntityHydrator,
  RequestContextService,
  EventBus,
} from '@vendure/core';
import { SellerOrder, LedgerEntry } from './entities';
import { MarketplacePaymentPluginOptions } from './types';
import { ProductSellersService } from '../product-sellers/product-sellers.service';

@Injectable()
export class MarketplacePaymentSubscriber implements OnModuleInit {
  private logger = new Logger('MarketplacePaymentSubscriber');

  constructor(
    private connection: TransactionalConnection,
    private channelService: ChannelService,
    private entityHydrator: EntityHydrator,
    private requestContextService: RequestContextService,
    private eventBus: EventBus,
    private productSellersService: ProductSellersService,
  ) {}

  private getPluginOptions(): MarketplacePaymentPluginOptions {
    return {
      platformFeePercent: 10, // default
      platformFeeSKU: 'platform-fee',
      autoPayouts: false,
      minimumPayoutAmount: 1000,
      ...(global as any).MARKETPLACE_PAYMENT_PLUGIN_OPTIONS,
    };
  }

  onModuleInit() {
    this.eventBus.ofType(OrderPlacedEvent).subscribe(async (evt: OrderPlacedEvent) => {
      await this.handleOrderPlaced(evt);
    });
  }

  private async handleOrderPlaced(evt: OrderPlacedEvent) {
    const ctx: RequestContext | undefined = (evt as any).ctx;
    const order: Order = evt.order;

    // Prefer to have ctx for repository calls; if not available, create one from order.channels
    let useCtx: RequestContext;
    if (ctx) {
      useCtx = ctx;
    } else {
      // Create a context from the order's first channel
      const firstChannel = order.channels?.[0];
      useCtx = await this.requestContextService.create({
        apiType: 'admin',
        channelOrToken: firstChannel?.token,
      });
    }

    // Ensure lines have productVariant channels hydrated for inference
    await this.entityHydrator.hydrate(useCtx, order, { 
      relations: ['lines.productVariant', 'lines.productVariant.channels'] 
    });

    // Group lines by sellerChannelId - using the existing multivendor infrastructure
    // The multivendor plugin already handles order splitting and platform fees
    // We just need to create ledger entries for tracking and payouts
    const groups = new Map<string, OrderLine[]>();
    const defaultChannel = await this.channelService.getDefaultChannel(useCtx).catch(() => undefined);

    for (const line of order.lines) {
      // PRIORITY 1: Use the explicitly selected seller channel from custom fields
      let sellerChannelId: string | undefined = (line as any).customFields?.selectedSellerChannelId;
      let sellerChannelCode: string | undefined = (line as any).customFields?.sellerChannelCode;
      
      // If we have a channel code but no ID, resolve the ID from the code
      if (!sellerChannelId && sellerChannelCode) {
        try {
          const channelRepo = this.connection.rawConnection.getRepository('Channel');
          const channel = await channelRepo.findOne({ where: { code: sellerChannelCode } });
          if (channel) {
            sellerChannelId = String((channel as any).id);
          }
        } catch (e) {
          this.logger.warn(`Could not resolve channel ID from code ${sellerChannelCode}`);
        }
      }
      
      // PRIORITY 2: Use the existing sellerChannelId that the multivendor plugin sets
      if (!sellerChannelId) {
        sellerChannelId = (line as any).sellerChannelId;
      }
      
      // PRIORITY 3: Validate that the product is actually available in the selected channel
      if (sellerChannelId) {
        try {
          // Get the product ID from the variant
          const productId = (line.productVariant as any)?.product?.id;
          if (productId) {
            const productSellers = await this.productSellersService.findSellers(useCtx, productId);
            const isProductInChannel = productSellers.some(seller => String(seller.channelId) === String(sellerChannelId));
            
            if (!isProductInChannel) {
              this.logger.warn(`Product ${productId} is not available in channel ${sellerChannelId}, falling back to default channel`);
              sellerChannelId = undefined;
              sellerChannelCode = undefined;
            }
          }
        } catch (e) {
          this.logger.warn(`Could not validate product-channel assignment: ${e}`);
        }
      }
      
      // PRIORITY 4: Fallback to channel inference if sellerChannelId is not set or invalid
      if (!sellerChannelId) {
        const channels = (line.productVariant as any)?.channels || [];
        if (channels.length === 2 && defaultChannel) {
          const sellerChannel = channels.find((c: any) => 
            !c.id || !defaultChannel ? true : String(c.id) !== String(defaultChannel.id)
          );
          if (sellerChannel) {
            sellerChannelId = String(sellerChannel.id);
          }
        } else if (channels.length > 0 && defaultChannel) {
          // if more than 2 channels, prefer any channel that isn't default
          const sellerChannel = channels.find((c: any) => String(c.id) !== String(defaultChannel.id));
          if (sellerChannel) sellerChannelId = String(sellerChannel.id);
        } else if (channels.length === 1) {
          sellerChannelId = String(channels[0].id);
        }
      }

      // PRIORITY 5: final fallback: use order's first channel id
      if (!sellerChannelId) {
        const firstChannel = order.channels?.[0];
        sellerChannelId = firstChannel?.id ? String(firstChannel.id) : 'unknown';
      }

      // Ensure we have the channel code for display purposes
      if (sellerChannelId && !sellerChannelCode) {
        try {
          const channelRepo = this.connection.rawConnection.getRepository('Channel');
          const channel = await channelRepo.findOne({ where: { id: sellerChannelId } });
          if (channel) {
            sellerChannelCode = (channel as any).code;
          }
        } catch (e) {
          this.logger.warn(`Could not resolve channel code from ID ${sellerChannelId}`);
        }
      }

      this.logger.log(`Order line ${line.id} assigned to channel: ${sellerChannelId} (${sellerChannelCode})`);
      
      const key = String(sellerChannelId);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(line);
    }

    // Get plugin options
    const pluginOptions = this.getPluginOptions();

    // Now create SellerOrder and ledger entries in a transaction
    await this.connection.withTransaction(async manager => {
      const sellerOrderRepo = this.connection.getRepository(useCtx, SellerOrder);
      const ledgerRepo = this.connection.getRepository(useCtx, LedgerEntry);

      for (const [channelId, lines] of groups.entries()) {
        // compute subtotalWithTax from lines (using proratedUnitPriceWithTax or unitPriceWithTax)
        let subtotalWithTax = 0;
        for (const l of lines) {
          const unitWithTax = (l as any).proratedUnitPriceWithTax ?? 
                             (l as any).unitPriceWithTax ?? 
                             (l as any).unitPrice ?? 0;
          const qty = (l as any).quantity ?? 1;
          subtotalWithTax += Math.round(unitWithTax * qty);
        }

        // approximate shipping share: proportional to subtotal
        const orderSubtotal = order.subTotalWithTax ?? order.totalWithTax ?? 0;
        const orderShipping = order.shippingWithTax ?? 0;
        const shippingWithTax = orderSubtotal > 0 ? 
          Math.round((subtotalWithTax / Math.max(1, orderSubtotal)) * orderShipping) : 0;

        const taxTotal = 0; // could compute from tax lines if required
        const totalWithTax = subtotalWithTax + shippingWithTax + taxTotal;

        // try to resolve seller name from channel (best-effort)
        let sellerId: string | undefined;
        let sellerName: string | undefined;
        try {
          // load channel relation using raw connection
          const channelRepo = this.connection.rawConnection.getRepository('Channel');
          const channel = await channelRepo.findOne({ 
            where: { id: channelId }, 
            relations: ['seller', 'customFields'] 
          });
          if (channel) {
            sellerId = (channel as any).seller?.id ?? channel.customFields?.sellerId ?? undefined;
            sellerName = (channel as any).seller?.name ?? channel.customFields?.sellerName ?? undefined;
          }
        } catch (e) {
          // ignore - best-effort
          const errorMessage = e instanceof Error ? e.message : 'Unknown error';
          this.logger.warn(`Could not resolve seller info for channel ${channelId}: ${errorMessage}`);
        }

        const sellerOrder = sellerOrderRepo.create({
          parentOrderId: String(order.id),
          sellerId: sellerId ?? null,
          sellerName: sellerName ?? null,
          state: 'paid' as const,
          currencyCode: order.currencyCode,
          subtotalWithTax,
          shippingWithTax,
          taxTotal,
          totalWithTax,
          lineRefs: lines.map(l => ({ 
            orderLineId: String(l.id), 
            quantity: (l as any).quantity ?? 1 
          })),
        } as any);
        const savedSellerOrder = (await sellerOrderRepo.save(sellerOrder)) as any;
        // Note: Do NOT create ShippingLine rows here. Shipping lines belong to Vendure Orders,
        // not to the custom SellerOrder entity. A dedicated subscriber (shipping-fix.subscriber)
        // ensures that after PaymentSettled, all Vendure Orders have a valid shipping method.

        // Ledger SALE (credit)
        const saleEntry = ledgerRepo.create({
          sellerId: sellerId ?? null,
          sellerName: sellerName ?? null,
          sellerOrderId: savedSellerOrder.id,
          type: 'SALE',
          amountWithTax: subtotalWithTax + shippingWithTax,
          reference: savedSellerOrder.id,
          description: `Sale from order ${order.code}`,
        } as any);
        await ledgerRepo.save(saleEntry);

        // Commission (platform fee)
        const commission = Math.round(((subtotalWithTax + shippingWithTax) * pluginOptions.platformFeePercent!) / 100);
        if (commission !== 0) {
          const commissionEntry = ledgerRepo.create({
            sellerId: sellerId ?? null,
            sellerName: sellerName ?? null,
            sellerOrderId: savedSellerOrder.id,
            type: 'COMMISSION',
            amountWithTax: -commission,
            reference: savedSellerOrder.id,
            description: `Platform commission (${pluginOptions.platformFeePercent}%)`,
          } as any);
          await ledgerRepo.save(commissionEntry);
        }
      }
    });

    this.logger.log(`Order ${order.code} processed for marketplace payment tracking.`);
  }
}
