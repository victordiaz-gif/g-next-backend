# Marketplace Payment Plugin

A comprehensive payment tracking and payout management system for Vendure multivendor marketplaces. This plugin extends the existing multivendor functionality to provide detailed ledger tracking, automated payout processing, and seller balance management.

## Features

- **Order Tracking**: Automatically creates ledger entries when orders are placed
- **Seller Balances**: Real-time calculation of seller account balances
- **Payout Management**: Manual and automated payout processing
- **Refund Handling**: Automatic ledger updates when refunds are processed
- **Admin Interface**: Complete admin API for managing seller finances
- **Multi-vendor Integration**: Seamlessly works with existing Vendure multivendor plugin
- **Central Payment System**: Integrated checkout flow with multiple vendor products
- **Seller Channel Selection**: Support for explicit seller channel selection during checkout

## Architecture

This plugin is designed as a **complementary extension** to the existing Vendure Multivendor plugin:

- **Leverages existing infrastructure**: Uses the existing `MultivendorSellerStrategy` for order splitting
- **Extends functionality**: Adds ledger tracking and payout management on top of existing order processing
- **No duplication**: Avoids recreating functionality that already exists in the multivendor plugin
- **Seamless integration**: Works alongside existing multivendor features without conflicts

## Installation

### Prerequisites

1. **Multivendor Plugin**: Ensure the Vendure Multivendor plugin is installed and configured
2. **Database**: The plugin requires the existing multivendor database schema
3. **Vendure Version**: Compatible with Vendure 3.4.0+

### Plugin Installation

1. Add the plugin to your `vendure-config.ts`:

```typescript
import { MarketplacePaymentPlugin } from './plugins/marketplace-payment/marketplace-payment.plugin';

export const config: VendureConfig = {
  // ... other config
  plugins: [
    // ... other plugins including MultivendorPlugin
    MultivendorPlugin.init({
      platformFeePercent: 10,
      platformFeeSKU: 'platform-fee',
    }),
    MarketplacePaymentPlugin.init({
      platformFeePercent: 10, // Should match multivendor plugin
      platformFeeSKU: 'platform-fee',
      autoPayouts: false,
      minimumPayoutAmount: 1000,
    }),
  ],
  customFields: {
    OrderLine: [
      {
        name: 'selectedSellerChannelId',
        type: 'string',
        label: [{ languageCode: LanguageCode.en, value: 'Selected Seller Channel ID' }],
        description: [{ languageCode: LanguageCode.en, value: 'The selected seller channel ID for this order line' }],
      },
      {
        name: 'sellerChannelCode',
        type: 'string',
        label: [{ languageCode: LanguageCode.en, value: 'Seller Channel Code' }],
        description: [{ languageCode: LanguageCode.en, value: 'The code of the selected seller channel for this order line' }],
      },
    ],
  },
};
```

2. Generate and run the database migration:

```bash
# Generate migration for marketplace payment entities
npx vendure migrate -g marketplace-payment-plugin

# Run migration
npx vendure migrate -r
```

3. Restart your Vendure server

## How It Works

### Integration with Multivendor Plugin

The marketplace payment plugin works alongside the existing multivendor plugin:

1. **Order Processing**: Multivendor plugin handles order splitting and platform fees
2. **Ledger Tracking**: Marketplace payment plugin creates ledger entries for tracking
3. **Payout Management**: Marketplace payment plugin manages seller payouts and balances

### Order Flow

1. **Customer places order**: Uses existing multivendor order processing
2. **Order splitting**: Multivendor plugin splits orders by seller
3. **Platform fees**: Multivendor plugin applies platform fees
4. **Ledger creation**: Marketplace payment plugin creates ledger entries
5. **Balance tracking**: Real-time seller balance updates

### Ledger System

The plugin maintains a comprehensive ledger for each seller:

- **SALE**: Credit entry when a sale is made
- **COMMISSION**: Debit entry for platform fees (already handled by multivendor)
- **PAYOUT**: Debit entry when money is paid out to seller
- **REFUND**: Debit entry when orders are refunded

## API Extensions

### Shop API

The plugin extends the Shop API with seller-specific functionality:

#### `addItemToOrderWithSeller` Mutation

```graphql
mutation {
  addItemToOrderWithSeller(
    productVariantId: "89"
    quantity: 1
    sellerChannelId: "2"
    sellerChannelCode: "sayaf-shop"
  ) {
    ... on Order {
      id
      code
      state
      lines {
        id
        quantity
        customFields {
          selectedSellerChannelId
          sellerChannelCode
        }
      }
    }
    ... on ErrorResult {
      errorCode
      message
    }
  }
}
```

### Admin API

The plugin provides comprehensive admin API for managing seller finances:

#### Queries

```graphql
# Get seller balance
query {
  sellerBalance(sellerId: "3")
}

# Get seller ledger entries
query {
  sellerLedger(sellerId: "3") {
    id
    type
    amountWithTax
    description
    createdAt
  }
}

# Get seller payouts
query {
  sellerPayouts(sellerId: "3") {
    id
    amount
    status
    createdAt
  }
}

# Get pending payouts
query {
  pendingPayouts {
    id
    sellerId
    sellerName
    amount
    status
  }
}
```

#### Mutations

```graphql
# Create manual payout
mutation {
  createVendorPayout(
    sellerId: "3"
    amount: 5000
    sellerName: "Sayaf Shop"
    notes: "Monthly payout"
  ) {
    id
    amount
    status
  }
}

# Mark payout as completed
mutation {
  markPayoutCompleted(
    payoutId: "payout-id"
    externalId: "stripe-transfer-123"
  ) {
    id
    status
    externalId
  }
}
```

## Database Schema

The plugin creates three main database tables:

### SellerOrder
Tracks individual seller orders created from split orders:
- `id`: Unique identifier
- `parentOrderId`: Reference to the original Vendure order
- `sellerId`: Seller identifier
- `sellerName`: Seller name for display
- `state`: Order state (pending, paid, fulfilled, cancelled)
- `currencyCode`: Currency code
- `subtotalWithTax`: Subtotal with tax
- `shippingWithTax`: Shipping cost with tax
- `taxTotal`: Tax total
- `totalWithTax`: Total with tax
- `lineRefs`: JSON array of order line references
- `createdAt`: Creation timestamp

### LedgerEntry
Tracks all financial transactions for sellers:
- `id`: Unique identifier
- `sellerId`: Seller identifier
- `sellerName`: Seller name
- `sellerOrderId`: Reference to seller order
- `type`: Transaction type (SALE, COMMISSION, PAYOUT, REFUND)
- `amountWithTax`: Transaction amount (positive for credits, negative for debits)
- `reference`: Reference to related entity
- `description`: Human-readable description
- `createdAt`: Creation timestamp

### VendorPayout
Tracks payout transactions:
- `id`: Unique identifier
- `sellerId`: Seller identifier
- `sellerName`: Seller name
- `amount`: Payout amount
- `status`: Payout status (pending, processing, completed, failed)
- `externalId`: External payment provider reference
- `notes`: Additional notes
- `createdAt`: Creation timestamp

## Quick Start (Step-by-step)

1) Configure the plugin and custom fields in `vendure-config.ts` (already included in this repo):
   - Register `MarketplacePaymentPlugin` and `MultivendorPlugin` (platformFeePercent should match)
   - Declare `OrderLine` custom fields `selectedSellerChannelId` and `sellerChannelCode`
   - Run DB migrations and restart the server

2) Ensure shipping methods are assigned to channels:
   - At least one global method visible in all channels (or one per channel)
   - Example codes used here: `standard-shipping` (id 1), `sayaf-shop-shipping` (id 3), `mission-prep-shipping` (id 4)

3) Use the provided Shop mutation `addItemToOrderWithSeller` from your storefront to pin seller selection per line.

4) Pre-payment, set only globally-eligible shipping method(s) (e.g. id `1`). After payment, the plugin ensures a shipping method visible to all order channels is applied to avoid Admin UI nulls.


## End-to-End Checkout Flow (Validated with 51, 55, 56)

1. Login (Shop):
```bash
curl -X POST http://localhost:3000/shop-api \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation { login(username: \"<email>\", password: \"<password>\") { __typename } }"}'
```

2. Add items with seller info (either `sellerChannelId` or `sellerChannelCode`):
```bash
# Product 51 -> variant 83 -> __default_channel__ (id 1)
# Product 55 -> variant 90        -> sayaf-shop (id 2)
# Product 56 -> variant 92        -> mission-prep (id 3)
curl -X POST http://localhost:3000/shop-api \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation { 
      a:addItemToOrderWithSeller(productVariantId: \"83\", quantity: 1, sellerChannelCode: \"__default_channel__\") { __typename }
      b:addItemToOrderWithSeller(productVariantId: \"90\", quantity: 1, sellerChannelCode: \"sayaf-shop\") { __typename }
      c:addItemToOrderWithSeller(productVariantId: \"92\", quantity: 1, sellerChannelCode: \"mission-prep\") { __typename }
    }"}'
```

3. Set addresses:
```bash
curl -X POST http://localhost:3000/shop-api \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation { setOrderShippingAddress(input:{ fullName: \"John Default\", streetLine1: \"123 Main\", city: \"SF\", postalCode: \"94105\", countryCode: \"US\" }) { __typename } }"}'

curl -X POST http://localhost:3000/shop-api \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation { setOrderBillingAddress(input:{ fullName: \"John Default\", streetLine1: \"123 Main\", city: \"SF\", postalCode: \"94105\", countryCode: \"US\" }) { __typename } }"}'
```

4. Set shipping pre-payment (use only globally-eligible ids, e.g. `["1"]`):
```bash
curl -X POST http://localhost:3000/shop-api \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation { setOrderShippingMethod(shippingMethodId: [\"1\"]) { __typename } }"}'
```

5. Transition and pay using the connected payment method:
```bash
curl -X POST http://localhost:3000/shop-api \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation { transitionOrderToState(state: \"ArrangingPayment\") { __typename } }"}'

curl -X POST http://localhost:3000/shop-api \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation { addPaymentToOrder(input: { method: \"connected-payment-method\", metadata: {} }) { __typename } }"}'
```

What happens after payment:
- Order is split per seller (per channel) for accounting
- SellerOrder and LedgerEntry rows are created
- A shipping line with a method visible in all order channels is ensured to avoid Admin UI nulls in channel views

## Admin API Testing (optional)

1. **Login as admin**:
```bash
curl -X POST http://localhost:3000/admin-api \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation { login(username: \"superadmin\", password: \"superadmin\") { ... on CurrentUser { id } } }"}'
```

2. **Check seller balance**:
```bash
curl -X POST http://localhost:3000/admin-api \
  -H "Content-Type: application/json" \
  -d '{"query":"query { sellerBalance(sellerId: \"3\") }"}'
```

3. **View ledger entries**:
```bash
curl -X POST http://localhost:3000/admin-api \
  -H "Content-Type: application/json" \
  -d '{"query":"query { sellerLedger(sellerId: \"3\") { id type amountWithTax description } }"}'
```

4. **Create payout**:
```bash
curl -X POST http://localhost:3000/admin-api \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation { createVendorPayout(sellerId: \"3\", amount: 5000, sellerName: \"Test Seller\", notes: \"Test payout\") { id amount status } }"}'
```

## Configuration Options

The plugin accepts the following configuration options:

```typescript
interface MarketplacePaymentPluginOptions {
  platformFeePercent: number;        // Platform fee percentage (should match multivendor)
  platformFeeSKU: string;            // SKU for platform fee line items
  autoPayouts: boolean;              // Enable automatic payouts
  minimumPayoutAmount: number;       // Minimum amount for payouts (in cents)
}
```

## Troubleshooting

### Common Issues

1. **Admin API Permission Errors**: Ensure you're logged in as superadmin
2. **Order Splitting Issues**: Verify multivendor plugin is properly configured
3. **Custom Fields Not Visible**: Check that custom fields are defined in vendure-config.ts
4. **Admin order list shows `Cannot return null for non-nullable field ShippingLine.shippingMethod`**
   - Pre-payment, set only globally-eligible methods (e.g. `["1"]`).
   - On `PaymentSettled`, the plugin assigns a shipping method which is visible in all order channels to the order's shipping line(s).
   - Ensure each seller channel has at least one active shipping method.
4. **Migration Errors**: Ensure database is clean before running migrations

### Debug Commands

```bash
# Check server health
curl http://localhost:3000/health

# Verify plugin loading
curl -X POST http://localhost:3000/admin-api \
  -H "Content-Type: application/json" \
  -d '{"query":"query { channels { id code } }"}'

# Check order splitting
curl -X POST http://localhost:3000/admin-api \
  -H "Content-Type: application/json" \
  -d '{"query":"query { orders(options:{ take: 10 }) { items { id code state channels { code } } } }"}'
```

## Integration Guide

### Frontend Integration

For frontend applications, use the `addItemToOrderWithSeller` mutation to specify seller channels:

```typescript
const addItemWithSeller = async (variantId: string, quantity: number, sellerChannelId?: string) => {
  const result = await client.mutate({
    mutation: ADD_ITEM_WITH_SELLER,
    variables: {
      productVariantId: variantId,
      quantity,
      sellerChannelId,
    },
  });
  return result.data.addItemToOrderWithSeller;
};
```

### Admin UI Integration

The plugin provides GraphQL queries and mutations that can be integrated into custom admin UI components:

```typescript
// Seller balance component
const SellerBalance = ({ sellerId }: { sellerId: string }) => {
  const { data } = useQuery(SELLER_BALANCE, { variables: { sellerId } });
  return <div>Balance: ${(data?.sellerBalance || 0) / 100}</div>;
};

// Payout management component
const PayoutManager = ({ sellerId }: { sellerId: string }) => {
  const [createPayout] = useMutation(CREATE_PAYOUT);
  
  const handlePayout = async (amount: number) => {
    await createPayout({
      variables: { sellerId, amount, sellerName: "Seller Name", notes: "Manual payout" }
    });
  };
  
  return <button onClick={() => handlePayout(5000)}>Create Payout</button>;
};
```

## Development

### Plugin Structure

```
marketplace-payment/
├── entities.ts                    # Database entities
├── marketplace-payment.plugin.ts  # Main plugin file
├── marketplace-payment.subscriber.ts # Order event subscriber
├── marketplace-payouts.service.ts # Payout business logic
├── admin-api-extensions.ts        # Admin API schema and resolvers
├── shop-api-extensions.ts         # Shop API schema and resolvers
├── add-item-with-seller.resolver.ts # Seller selection resolver
├── refunds.subscriber.ts          # Refund event handling
├── types.ts                       # Plugin configuration types
└── index.ts                       # Plugin exports
```

### Adding New Features

1. **New API Endpoints**: Add to `admin-api-extensions.ts` or `shop-api-extensions.ts`
2. **New Entities**: Define in `entities.ts` and add to plugin configuration
3. **New Services**: Create service file and add to plugin providers
4. **New Event Handlers**: Create subscriber and add to plugin providers

### Testing New Features

1. **Unit Tests**: Test individual components and services
2. **Integration Tests**: Test complete order flow
3. **API Tests**: Test GraphQL endpoints
4. **Database Tests**: Verify entity relationships and data integrity

## Support

For issues and questions:

1. Check the troubleshooting section above
2. Verify plugin configuration matches requirements
3. Ensure all prerequisites are met
4. Test with the provided example commands

## License

This plugin is part of the Vendure ecosystem and follows the same licensing terms as Vendure.
