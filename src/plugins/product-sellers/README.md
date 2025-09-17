# Product Sellers Plugin

A Vendure plugin that extends the GraphQL schema to provide seller information for products and search results. This plugin allows you to retrieve detailed seller data including channel information, seller IDs, and seller names for both direct product queries and search operations.

## Features

- **Product Seller Information**: Extends the `Product` type with a `productSellers` field
- **Search Result Seller Information**: Extends the `SearchResult` type with a `productSellers` field
- **Efficient Batch Loading**: Uses a per-request batch loader to optimize database queries
- **Vendure 3.4.0 Compatible**: Built specifically for Vendure 3.4.0
- **Elasticsearch Integration**: Works seamlessly with the Elasticsearch plugin for search functionality

## How It Works

### Architecture Overview

The plugin consists of several key components:

1. **GraphQL Schema Extension**: Extends both `Product` and `SearchResult` types
2. **Field Resolvers**: Resolves the `productSellers` field for different types
3. **Service Layer**: Handles business logic and database operations
4. **Batch Loader**: Optimizes database queries by batching multiple requests

### Data Flow

```
GraphQL Query → Field Resolver → Batch Loader → Service → Database → Response
```

### Database Relations

The plugin leverages Vendure's channel system to determine seller information:
- Products are associated with channels
- Channels can have seller information (either direct relations or custom fields)
- The plugin maps channel data to seller information

## GraphQL Schema

### Extended Types

```graphql
type ProductSeller {
  channelId: ID!
  channelCode: String!
  sellerId: ID
  sellerName: String
}

extend type Product {
  productSellers: [ProductSeller!]!
}

extend type SearchResult {
  productSellers: [ProductSeller!]!
}

extend type Query {
  productSellers(productId: ID!): [ProductSeller!]!
}
```

### Field Descriptions

- **`channelId`**: Unique identifier for the channel
- **`channelCode`**: Human-readable code for the channel
- **`sellerId`**: Unique identifier for the seller (if available)
- **`sellerName`**: Human-readable name for the seller (if available)

## Usage Examples

### 1. Direct Product Query

Get seller information for a specific product:

```graphql
query GetProductWithSellers($id: ID!) {
  product(id: $id) {
    id
    name
    slug
    productSellers {
      channelId
      channelCode
      sellerId
      sellerName
    }
  }
}
```

**Variables:**
```json
{
  "id": "1"
}
```

**Response:**
```json
{
  "data": {
    "product": {
      "id": "1",
      "name": "Laptop",
      "slug": "laptop",
      "productSellers": [
        {
          "channelId": "1",
          "channelCode": "__default_channel__",
          "sellerId": "1",
          "sellerName": "G-commerce"
        }
      ]
    }
  }
}
```

### 2. Search Query with Seller Information

Search for products and include seller data:

```graphql
query SearchProductsWithSellers($term: String, $take: Int) {
  search(input: { term: $term, take: $take }) {
    totalItems
    items {
      productId
      productName
      slug
      priceWithTax {
        ... on SinglePrice {
          value
        }
        ... on PriceRange {
          min
          max
        }
      }
      currencyCode
      productSellers {
        channelId
        channelCode
        sellerId
        sellerName
      }
    }
  }
}
```

**Variables:**
```json
{
  "term": "laptop",
  "take": 5
}
```

**Response:**
```json
{
  "data": {
    "search": {
      "totalItems": 4,
      "items": [
        {
          "productId": "1",
          "productName": "Laptop",
          "slug": "laptop",
          "priceWithTax": {
            "value": 155880
          },
          "currencyCode": "USD",
          "productSellers": [
            {
              "channelId": "1",
              "channelCode": "__default_channel__",
              "sellerId": "1",
              "sellerName": "G-commerce"
            }
          ]
        }
      ]
    }
  }
}
```

### 3. Collection Products with Seller Information

Get products from a specific collection with seller data:

```graphql
query GetCollectionProducts($slug: String!, $skip: Int, $take: Int) {
  search(input: { 
    collectionSlug: $slug, 
    groupByProduct: true, 
    skip: $skip, 
    take: $take 
  }) {
    totalItems
    items {
      productId
      productVariantId
      productVariantName
      productName
      slug
      productAsset {
        id
        preview
      }
      priceWithTax {
        ... on SinglePrice {
          value
        }
        ... on PriceRange {
          min
          max
        }
      }
      currencyCode
      productSellers {
        channelId
        channelCode
        sellerId
        sellerName
      }
    }
  }
}
```

**Variables:**
```json
{
  "slug": "electronics",
  "skip": 0,
  "take": 10
}
```

**Response:**
```json
{
  "data": {
    "search": {
      "totalItems": 20,
      "items": [
        {
          "productId": "1",
          "productVariantId": "1",
          "productVariantName": "Laptop 13 inch 16GB",
          "productName": "Laptop",
          "slug": "laptop",
          "productAsset": {
            "id": "1",
            "preview": "http://localhost:3000/assets/preview/71/derick-david-409858-unsplash__preview.jpg"
          },
          "priceWithTax": {
            "min": 155880,
            "max": 275880
          },
          "currencyCode": "USD",
          "productSellers": [
            {
              "channelId": "1",
              "channelCode": "__default_channel__",
              "sellerId": "1",
              "sellerName": "G-commerce"
            }
          ]
        }
      ]
    }
  }
}
```

### 4. Direct Product Sellers Query

Get seller information for a specific product using the dedicated query:

```graphql
query GetProductSellers($productId: ID!) {
  productSellers(productId: $productId) {
    channelId
    channelCode
    sellerId
    sellerName
  }
}
```

**Variables:**
```json
{
  "productId": "1"
}
```

**Response:**
```json
{
  "data": {
    "productSellers": [
      {
        "channelId": "1",
        "channelCode": "__default_channel__",
        "sellerId": "1",
        "sellerName": "G-commerce"
      }
    ]
  }
}
```

### 5. Advanced Search with Filters

Search with additional filters while including seller information:

```graphql
query AdvancedSearch($term: String, $priceRange: PriceRangeInput, $inStock: Boolean) {
  search(input: { 
    term: $term, 
    priceRange: $priceRange, 
    inStock: $inStock,
    take: 10 
  }) {
    totalItems
    items {
      productId
      productName
      slug
      inStock
      priceWithTax {
        ... on SinglePrice {
          value
        }
        ... on PriceRange {
          min
          max
        }
      }
      productSellers {
        channelId
        channelCode
        sellerId
        sellerName
      }
    }
  }
}
```

**Variables:**
```json
{
  "term": "electronics",
  "priceRange": {
    "min": 100000,
    "max": 500000
  },
  "inStock": true
}
```

## Testing the Plugin

### 1. Start the Development Server

```bash
cd apps/vendure-backend
npm run dev:server
```

### 2. Test GraphQL Endpoint

The plugin extends the shop API. Test it at:
```
http://localhost:3000/shop-api
```

### 3. Verify Schema

Check that the new types are available:

```graphql
query IntrospectSchema {
  __schema {
    types {
      name
      fields {
        name
        type {
          name
        }
      }
    }
  }
}
```

### 4. Test with cURL

```bash
# Test search with seller information
curl -X POST http://localhost:3000/shop-api \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { search(input: { take: 1 }) { items { productId productName productSellers { channelId channelCode sellerId sellerName } } } }"
  }'
```

## Configuration

### Plugin Initialization

```typescript
// vendure-config.ts
import { ProductSellersPlugin } from './plugins/product-sellers/product-sellers.plugin';

export const config: VendureConfig = {
  // ... other config
  plugins: [
    // ... other plugins
    ProductSellersPlugin.init({}),
  ],
};
```

### Environment Requirements

- **Vendure Version**: 3.4.0
- **Database**: PostgreSQL (with proper channel setup)
- **Optional**: Elasticsearch plugin for enhanced search functionality

## Performance Considerations

### Batch Loading

The plugin implements a sophisticated batch loading mechanism:

- **Per-Request Caching**: Each GraphQL request gets its own loader instance
- **Batch Database Queries**: Multiple product IDs are batched into single database queries
- **Memory Efficient**: Uses Maps and Sets for optimal memory usage
- **Error Handling**: Gracefully handles database errors without breaking the request

### Database Optimization

- **Eager Loading**: Loads channel and seller relations in single queries
- **Indexed Fields**: Relies on Vendure's indexed fields (product.id, channel.id)
- **Minimal Overhead**: Adds minimal performance impact to existing queries

## Troubleshooting

### Common Issues

1. **No Seller Information Returned**
   - Check if products have channels assigned
   - Verify channel-seller relationships in the database
   - Ensure custom fields are properly configured

2. **GraphQL Schema Errors**
   - Verify plugin is properly initialized in vendure-config.ts
   - Check for TypeScript compilation errors
   - Restart the development server

3. **Performance Issues**
   - Monitor database query performance
   - Check if batch loading is working correctly
   - Verify database indexes on channel and seller tables

### Debug Mode

Enable debug logging by setting the environment variable:
```bash
DEBUG=ProductSellersPlugin npm run dev:server
```

## Contributing

### Development Setup

1. Clone the repository
2. Install dependencies: `pnpm install`
3. Build the plugin: `npm run build`
4. Start development server: `npm run dev:server`

### Code Structure

```
product-sellers/
├── constants.ts          # Plugin constants
├── types.ts             # TypeScript interfaces
├── product-sellers.service.ts    # Business logic
├── product-sellers.resolver.ts   # GraphQL resolvers
├── product-sellers.loader.ts     # Batch loading logic
├── product-sellers.plugin.ts     # Main plugin class
└── README.md            # This documentation
```

## License

This plugin is part of the Vendure ecosystem and follows the same licensing terms.
