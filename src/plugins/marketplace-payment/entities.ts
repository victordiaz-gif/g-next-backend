import { VendureEntity } from '@vendure/core';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  OneToMany,
  UpdateDateColumn,
} from 'typeorm';

/**
 * SellerOrder - per-seller operational order produced by splitting the aggregate order.
 * We store sellerId and sellerName as strings to avoid tight coupling to an external Seller entity.
 * You may change sellerId to a @ManyToOne relation later if you prefer.
 */
@Entity()
export class SellerOrder extends VendureEntity {
  @PrimaryGeneratedColumn('uuid') 
  id: string;

  @Column() 
  parentOrderId: string; // Vendure Order.id

  // Optional seller metadata (no relation here to keep plugin portable)
  @Column({ nullable: true }) 
  sellerId?: string;
  
  @Column({ nullable: true }) 
  sellerName?: string;

  @Column() 
  state: 'pending' | 'paid' | 'fulfilled' | 'cancelled';

  @Column() 
  currencyCode: string;

  @Column('int') 
  subtotalWithTax: number;
  
  @Column('int') 
  shippingWithTax: number;
  
  @Column('int') 
  taxTotal: number;
  
  @Column('int') 
  totalWithTax: number;

  // store line refs for traceability: [{ orderLineId, quantity }]
  @Column('jsonb') 
  lineRefs: Array<{ orderLineId: string; quantity: number }>;

  @CreateDateColumn() 
  createdAt: Date;

  @UpdateDateColumn() 
  updatedAt: Date;

  @OneToMany(() => LedgerEntry, (l) => l.sellerOrderId)
  ledgerEntries?: LedgerEntry[];
}

/**
 * LedgerEntry - simple ledger for seller accounting
 * amountWithTax: positive = credit to seller, negative = debit
 */
@Entity()
export class LedgerEntry extends VendureEntity {
  @PrimaryGeneratedColumn('uuid') 
  id: string;

  @Column({ nullable: true }) 
  sellerId?: string;
  
  @Column({ nullable: true }) 
  sellerName?: string;

  @Column({ nullable: true }) 
  sellerOrderId?: string;
  
  // type: SALE | COMMISSION | FEE | REFUND | PAYOUT
  @Column() 
  type: string;

  @Column('int') 
  amountWithTax: number;

  @Column({ nullable: true }) 
  reference?: string;

  @Column({ nullable: true }) 
  description?: string;

  @CreateDateColumn() 
  createdAt: Date;

  @UpdateDateColumn() 
  updatedAt: Date;
}

/**
 * VendorPayout - records of payouts (admin-triggered or automated)
 */
@Entity()
export class VendorPayout extends VendureEntity {
  @PrimaryGeneratedColumn('uuid') 
  id: string;

  @Column() 
  sellerId: string;
  
  @Column({ nullable: true }) 
  sellerName?: string;

  @Column('int') 
  amount: number;
  
  @Column() 
  status: 'pending' | 'processing' | 'completed' | 'failed';
  
  @Column({ nullable: true }) 
  externalId?: string;

  @Column({ nullable: true }) 
  notes?: string;

  @CreateDateColumn() 
  createdAt: Date;

  @UpdateDateColumn() 
  updatedAt: Date;
}
