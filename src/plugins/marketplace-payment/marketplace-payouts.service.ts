import { Injectable } from '@nestjs/common';
import { TransactionalConnection, RequestContext } from '@vendure/core';
import { VendorPayout, LedgerEntry } from './entities';

@Injectable()
export class MarketplacePayoutsService {
  constructor(private connection: TransactionalConnection) {}

  /**
   * Get the current balance for a seller
   */
  async getSellerBalance(ctx: RequestContext, sellerId: string): Promise<number> {
    const ledgerRepo = this.connection.getRepository(ctx, LedgerEntry);
    const row = await ledgerRepo.createQueryBuilder('l')
      .select('SUM(l.amountWithTax)', 'balance')
      .where('l.sellerId = :sid', { sid: sellerId })
      .getRawOne();
    return Number(row?.balance ?? 0);
  }

  /**
   * Get all ledger entries for a seller
   */
  async getSellerLedger(ctx: RequestContext, sellerId: string): Promise<LedgerEntry[]> {
    const ledgerRepo = this.connection.getRepository(ctx, LedgerEntry);
    return ledgerRepo.find({
      where: { sellerId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get all payouts for a seller
   */
  async getSellerPayouts(ctx: RequestContext, sellerId: string): Promise<VendorPayout[]> {
    const payoutRepo = this.connection.getRepository(ctx, VendorPayout);
    return payoutRepo.find({
      where: { sellerId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Create a manual payout for a seller
   */
  async createManualPayout(
    ctx: RequestContext, 
    sellerId: string, 
    amount: number, 
    sellerName?: string,
    notes?: string
  ): Promise<VendorPayout> {
    const payoutRepo = this.connection.getRepository(ctx, VendorPayout);
    const ledgerRepo = this.connection.getRepository(ctx, LedgerEntry);

    // Check if seller has sufficient balance
    const currentBalance = await this.getSellerBalance(ctx, sellerId);
    if (currentBalance < amount) {
      throw new Error(`Insufficient balance. Available: ${currentBalance}, requested: ${amount}`);
    }

    const payout = payoutRepo.create({
      sellerId,
      sellerName: sellerName ?? null,
      amount,
      status: 'pending' as const,
      notes: notes ?? null,
    } as any);
    const savedPayout = (await payoutRepo.save(payout))[0] as VendorPayout;

    // Create negative ledger entry for the payout
    const payoutEntry = ledgerRepo.create({
      sellerId,
      sellerName: sellerName ?? null,
      type: 'PAYOUT',
      amountWithTax: -Math.abs(amount),
      reference: savedPayout.id,
      description: `Manual payout - ${notes || 'No notes'}`,
    } as any);
    await ledgerRepo.save(payoutEntry);

    return savedPayout;
  }

  /**
   * Mark a payout as completed
   */
  async markPayoutCompleted(
    ctx: RequestContext, 
    payoutId: string, 
    externalId?: string
  ): Promise<VendorPayout> {
    const payoutRepo = this.connection.getRepository(ctx, VendorPayout);
    const payout = await payoutRepo.findOne({ where: { id: payoutId } });
    
    if (!payout) {
      throw new Error('Payout not found');
    }
    
    payout.status = 'completed';
    payout.externalId = externalId ?? payout.externalId;
    await payoutRepo.save(payout);
    
    return payout;
  }

  /**
   * Mark a payout as failed
   */
  async markPayoutFailed(
    ctx: RequestContext, 
    payoutId: string, 
    notes?: string
  ): Promise<VendorPayout> {
    const payoutRepo = this.connection.getRepository(ctx, VendorPayout);
    const payout = await payoutRepo.findOne({ where: { id: payoutId } });
    
    if (!payout) {
      throw new Error('Payout not found');
    }
    
    payout.status = 'failed';
    payout.notes = notes ?? payout.notes;
    await payoutRepo.save(payout);
    
    return payout;
  }

  /**
   * Get all pending payouts
   */
  async getPendingPayouts(ctx: RequestContext): Promise<VendorPayout[]> {
    const payoutRepo = this.connection.getRepository(ctx, VendorPayout);
    return payoutRepo.find({
      where: { status: 'pending' },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Get seller statistics
   */
  async getSellerStats(ctx: RequestContext, sellerId: string) {
    const ledgerRepo = this.connection.getRepository(ctx, LedgerEntry);
    
    const stats = await ledgerRepo.createQueryBuilder('l')
      .select([
        'SUM(CASE WHEN l.type = \'SALE\' THEN l.amountWithTax ELSE 0 END) as totalSales',
        'SUM(CASE WHEN l.type = \'COMMISSION\' THEN ABS(l.amountWithTax) ELSE 0 END) as totalCommissions',
        'SUM(CASE WHEN l.type = \'PAYOUT\' THEN ABS(l.amountWithTax) ELSE 0 END) as totalPayouts',
        'COUNT(CASE WHEN l.type = \'SALE\' THEN 1 END) as saleCount',
        'COUNT(CASE WHEN l.type = \'PAYOUT\' THEN 1 END) as payoutCount'
      ])
      .where('l.sellerId = :sid', { sid: sellerId })
      .getRawOne();

    return {
      totalSales: Number(stats?.totalSales ?? 0),
      totalCommissions: Number(stats?.totalCommissions ?? 0),
      totalPayouts: Number(stats?.totalPayouts ?? 0),
      saleCount: Number(stats?.saleCount ?? 0),
      payoutCount: Number(stats?.payoutCount ?? 0),
      currentBalance: await this.getSellerBalance(ctx, sellerId),
    };
  }
}
