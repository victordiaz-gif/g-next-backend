// apps/vendure-backend/src/plugins/product-sellers/product-sellers.loader.ts
import { RequestContext } from '@vendure/core';
import { ProductSellersService, SimpleSeller } from './product-sellers.service';

type Loader = {
  load: (productId: string) => Promise<SimpleSeller[]>;
};

export function getOrCreateSellersLoader(ctx: RequestContext, svc: ProductSellersService): Loader {
  const KEY = '_productSellersLoader';
  // reuse if created
  if ((ctx as any)[KEY]) return (ctx as any)[KEY];

  // internal batch
  let pendingIds = new Set<string>();
  let resolveMap: Map<string, (v: SimpleSeller[]) => void> = new Map();
  let flushScheduled = false;

  const scheduleFlush = () => {
    if (flushScheduled) return;
    flushScheduled = true;
    // next microtask: allows collecting all product ids in current request
    process.nextTick(async () => {
      flushScheduled = false;
      const ids = Array.from(pendingIds);
      pendingIds = new Set();
      try {
        const map = await svc.getSellersForProductIds(ctx, ids);
        // resolve each promise
        for (const id of ids) {
          const resolver = resolveMap.get(id);
          if (resolver) {
            resolver(map.get(id) ?? []);
            resolveMap.delete(id);
          }
        }
      } catch (err) {
        // on error resolve all with empty arrays to avoid hanging queries
        for (const id of ids) {
          const resolver = resolveMap.get(id);
          if (resolver) {
            resolver([]);
            resolveMap.delete(id);
          }
        }
      }
    });
  };

  const loader: Loader = {
    load: (productId: string) =>
      new Promise<SimpleSeller[]>((resolve) => {
        // register id and resolver
        pendingIds.add(productId);
        resolveMap.set(productId, resolve);
        scheduleFlush();
      }),
  };

  (ctx as any)[KEY] = loader;
  return loader;
}
