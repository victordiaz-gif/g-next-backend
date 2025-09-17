import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  TransactionalConnection,
  OrderStateTransitionEvent,
  RequestContext,
  Order,
  ShippingMethodService,
  EntityHydrator,
  EventBus,
} from '@vendure/core';

@Injectable()
export class ShippingFixSubscriber implements OnModuleInit {
  private logger = new Logger('ShippingFixSubscriber');

  constructor(
    private connection: TransactionalConnection,
    private shippingMethodService: ShippingMethodService,
    private entityHydrator: EntityHydrator,
    private eventBus: EventBus,
  ) {}

  onModuleInit() {
    // Listen for order state transitions to "PaymentSettled" which happens after order splitting
    this.eventBus
      .ofType(OrderStateTransitionEvent)
      .subscribe(async (event: OrderStateTransitionEvent) => {
        if (event.toState === 'PaymentSettled') {
          await this.fixShippingMethods(event);
        }
      });
  }

  private async fixShippingMethods(event: OrderStateTransitionEvent) {
    const order = event.order;
    const ctx = event.ctx;

    try {
      // Regardless of parent/child, ensure the order has valid shipping method assignments
      await this.fixOrderShippingMethods(ctx, order);
    } catch (error) {
      this.logger.warn(`Failed to fix shipping methods for order ${order.code}: ${error}`);
    }
  }

  private async fixOrderShippingMethods(ctx: RequestContext, order: Order) {
    try {
      // Hydrate the order with shipping lines and shipping methods
      await this.entityHydrator.hydrate(ctx, order, {
        relations: ['shippingLines', 'shippingLines.shippingMethod', 'shippingLines.shippingMethod.channels', 'channels'],
      });

      // Find available shipping methods tied to the order's channels
      const shippingMethodRepo = this.connection.getRepository(ctx, 'ShippingMethod');
      const channelIds = (order.channels || []).map(c => (c as any).id);

      // Build a map of channelId -> available shipping methods for that channel
      const channelIdToMethods = new Map<string, any[]>();
      for (const chId of channelIds) {
        const methods = await shippingMethodRepo
          .createQueryBuilder('sm')
          .leftJoinAndSelect('sm.channels', 'ch')
          .where('ch.id = :id', { id: chId })
          .getMany();
        channelIdToMethods.set(String(chId), methods);
      }

      // Try to find a single shipping method visible in ALL order channels.
      // This avoids Admin UI nulls in any channel view because the method is channel-visible everywhere.
      const allMethods = await shippingMethodRepo
        .createQueryBuilder('sm')
        .leftJoinAndSelect('sm.channels', 'ch')
        .getMany();
      const orderChannelIdSet = new Set(channelIds.map((id: any) => String(id)));
      let universalMethod = allMethods.find(sm => {
        const smChannelIds = (sm.channels || []).map((c: any) => String(c.id));
        return Array.from(orderChannelIdSet).every(id => smChannelIds.includes(id));
      });
      if (!universalMethod && allMethods.length > 0) {
        // Fallback: take the first method and attach missing channels
        const channelRepo = this.connection.getRepository(ctx, 'Channel');
        const missingChannels = await channelRepo.find({ where: { id: channelIds } } as any);
        universalMethod = allMethods[0];
        const currentIds = new Set((universalMethod.channels || []).map((c: any) => String(c.id)));
        for (const ch of missingChannels) {
          if (!currentIds.has(String((ch as any).id))) {
            (universalMethod.channels as any[]).push(ch);
          }
        }
        await shippingMethodRepo.save(universalMethod as any);
      }

      if (channelIds.length === 0) {
        this.logger.warn(`Order ${order.code} has no channels; skipping shipping fix`);
        return;
      }

      // Preferred method is the universal one (visible in all channels). As a fallback, pick first channel's method.
      const firstChannelId = String(channelIds[0]);
      const defaultShippingMethod = universalMethod || (channelIdToMethods.get(firstChannelId) || [])[0];

      const shippingLineRepo = this.connection.getRepository(ctx, 'ShippingLine');

      // If no shipping lines exist on this order, create one with a default method (price 0)
      if (!order.shippingLines || order.shippingLines.length === 0) {
        // create a single line with the universal (or default) method to be visible in all channels
        if (defaultShippingMethod) {
          const newLine = shippingLineRepo.create({
            orderId: (order as any).id,
            shippingMethod: defaultShippingMethod,
            listPrice: 0,
            listPriceIncludesTax: true,
            adjustments: '[]',
            taxLines: '[]',
          } as any);
          await shippingLineRepo.save(newLine);
          this.logger.log(`Created shipping line for order ${order.code} with method ${defaultShippingMethod.code}`);
        }
        return;
      }

      // For each shipping line, ensure method belongs to one of the order channels; if not, replace
      // Ensure each existing line has a method visible in ALL order channels (avoid Admin UI nulls)
      for (const shippingLine of order.shippingLines) {
        const existing = await shippingLineRepo.findOne({ where: { id: shippingLine.id }, relations: ['shippingMethod', 'shippingMethod.channels'] } as any);
        const method = existing && (existing as any).shippingMethod;
        const methodChannelIds: string[] = method?.channels?.map((ch: any) => String(ch.id)) ?? [];
        const isUniversal = method && Array.from(orderChannelIdSet).every(id => methodChannelIds.includes(id));
        if (!method || !isUniversal) {
          const replacement = defaultShippingMethod;
          if (replacement) {
            (existing as any).shippingMethod = replacement;
            await shippingLineRepo.save(existing as any);
            this.logger.log(`Reassigned shipping method for shipping line ${shippingLine.id} in order ${order.code} to ${replacement.code}`);
          }
        }
      }
      // No need to create per-channel lines; one universal method per order avoids Admin UI nulls
    } catch (error) {
      this.logger.error(
        `Error fixing shipping methods for order ${order.code}: ${error}`
      );
    }
  }
}
