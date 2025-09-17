import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  TransactionalConnection,
  RequestContext,
  RequestContextService,
  RefundStateTransitionEvent,
  Order,
  OrderService,
  EventBus,
} from '@vendure/core';
import { LedgerEntry, SellerOrder } from './entities';

@Injectable()
export class RefundsSubscriber implements OnModuleInit {
  private logger = new Logger('RefundsSubscriber');

  constructor(
    private connection: TransactionalConnection,
    private requestContextService: RequestContextService,
    private orderService: OrderService,
    private eventBus: EventBus,
  ) {}

  onModuleInit() {
    this.eventBus.ofType(RefundStateTransitionEvent).subscribe(async (evt: RefundStateTransitionEvent) => {
      await this.handleRefund(evt);
    });
  }

  private async handleRefund(evt: RefundStateTransitionEvent) {
    const ctx: RequestContext | undefined = (evt as any).ctx;
    const order: Order = evt.refund.payment.order;
    const refundAmount = evt.refund.total;

    // Create context if not available
    let useCtx: RequestContext;
    if (ctx) {
      useCtx = ctx;
    } else {
      const firstChannel = order.channels?.[0];
      useCtx = await this.requestContextService.create({
        apiType: 'admin',
        channelOrToken: firstChannel?.token,
      });
    }

    // Find the corresponding seller orders for this order
    const sellerOrderRepo = this.connection.getRepository(useCtx, SellerOrder);
    const ledgerRepo = this.connection.getRepository(useCtx, LedgerEntry);

    const sellerOrders = await sellerOrderRepo.find({
      where: { parentOrderId: String(order.id) },
    });

    if (sellerOrders.length === 0) {
      this.logger.warn(`No seller orders found for order ${order.code}`);
      return;
    }

    // Calculate refund distribution based on seller order totals
    const totalOrderAmount = sellerOrders.reduce((sum, so) => sum + so.totalWithTax, 0);
    
    await this.connection.withTransaction(async manager => {
      for (const sellerOrder of sellerOrders) {
        // Calculate proportional refund amount for this seller
        const sellerRefundAmount = Math.round(
          (sellerOrder.totalWithTax / totalOrderAmount) * refundAmount
        );

        if (sellerRefundAmount > 0) {
          // Create refund ledger entry
          const refundEntry = ledgerRepo.create({
            sellerId: sellerOrder.sellerId ?? null,
            sellerName: sellerOrder.sellerName ?? null,
            sellerOrderId: sellerOrder.id,
            type: 'REFUND',
            amountWithTax: -sellerRefundAmount, // Negative for refund
            reference: String(order.id),
            description: `Refund for order ${order.code}`,
          } as any);
          await ledgerRepo.save(refundEntry);

          // Update seller order state if full refund
          if (sellerRefundAmount >= sellerOrder.totalWithTax) {
            sellerOrder.state = 'cancelled';
            await sellerOrderRepo.save(sellerOrder);
          }
        }
      }
    });

    this.logger.log(`Processed refund of ${refundAmount} for order ${order.code}`);
  }
}
