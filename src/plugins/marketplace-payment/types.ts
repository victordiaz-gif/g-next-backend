export interface MarketplacePaymentPluginOptions {
  /**
   * Platform fee percentage (e.g., 10 for 10%)
   */
  platformFeePercent?: number;
  
  /**
   * Platform fee SKU for surcharges
   */
  platformFeeSKU?: string;
  
  /**
   * Whether to automatically create payouts
   */
  autoPayouts?: boolean;
  
  /**
   * Minimum payout amount
   */
  minimumPayoutAmount?: number;
}
