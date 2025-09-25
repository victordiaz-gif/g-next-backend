# Stress Testing Guide

This guide explains how to perform stress testing on the Vendure backend by importing large datasets of products.

## Overview

The stress testing system allows you to:
- Generate test product data (1M and 5M products)
- Import products in batches to avoid memory issues
- Monitor performance during large-scale imports
- Test system behavior under high load

## Prerequisites

- **Google Cloud Project** with Cloud Run and Cloud Build enabled
- **Cloud Run Jobs** configured for batch processing
- **Sufficient resources** allocated for large-scale operations
- **Database** with adequate storage and performance

## Quick Start

### 1. Generate Test Data

#### Generate 1 Million Products
```bash
npm run generate:1m-products
```

#### Generate 5 Million Products
```bash
npm run generate:5m-products
```

#### Generate All Products (1M + 5M)
```bash
npm run generate:all-products
```

### 2. Import Products

#### Import 5 Million Products
```bash
npm run import:5m-products
```

#### Import by Chunks (for large datasets)
```bash
npm run import:chunk-1
npm run import:chunk-2
npm run import:chunk-3
npm run import:chunk-4
npm run import:chunk-5
```

## Cloud Run Jobs

For production stress testing, use Google Cloud Run Jobs which provide:
- **High memory allocation** (up to 8GB)
- **Multiple CPU cores** (up to 4 CPUs)
- **Extended timeouts** (up to 2 hours)
- **Automatic scaling** based on workload

### Available Jobs

1. **vendure-generate-all-products**
   - Generates 1M products first, then 5M products
   - Memory: 8GB, CPU: 4 cores
   - Timeout: 2 hours

2. **vendure-import-5m-products**
   - Imports 5M products into the database
   - Memory: 8GB, CPU: 4 cores
   - Timeout: 2 hours

### Running Cloud Run Jobs

#### From Google Cloud Console
1. Go to [Cloud Run Jobs](https://console.cloud.google.com/run/jobs)
2. Select the job you want to run
3. Click "Execute" or "Run now"
4. Monitor progress in the logs

#### From Command Line
```bash
# Generate all products
gcloud run jobs execute vendure-generate-all-products --region=us-central1

# Import 5M products
gcloud run jobs execute vendure-import-5m-products --region=us-central1
```

## Data Generation

### Product Structure

Each generated product includes:
- **Product Information**:
  - Name, slug, description
  - Assets and facets
  - Option groups (Color, Size)

- **Variants**:
  - SKU, price, stock
  - Option values
  - Custom fields
  - Tax category

### CSV Format

The generated CSV files follow this structure:
```csv
name,slug,description,assets,facets,optionGroups,optionValues,sku,price,taxCategory,stockOnHand,trackInventory,variantAssets,variantFacets
"Electronics Product 1","product-1","Description for Electronics Product 1","product-1-main.jpg","category:Electronics|brand:BrandA","Color|Size","","","","","","","",""
"","","","","","","Red|XS","SKU-1-Red-XS","45.67","standard","150","true","variant-1-1.jpg","color:Red|size:XS"
```

## Performance Considerations

### Memory Management

- **Streaming approach** for large files (5M+ products)
- **Batch processing** to avoid memory overflow
- **Chunked imports** for very large datasets

### Database Optimization

- **Indexes** on frequently queried fields
- **Connection pooling** for high concurrency
- **Batch inserts** for better performance

### Resource Allocation

| Operation | Memory | CPU | Timeout |
|-----------|--------|-----|---------|
| Generate 1M | 2GB | 2 cores | 30 min |
| Generate 5M | 4GB | 2 cores | 1 hour |
| Import 5M | 8GB | 4 cores | 2 hours |

## Monitoring and Troubleshooting

### Logs

Monitor job execution through:
- **Cloud Run Jobs logs** in Google Cloud Console
- **Application logs** for detailed progress
- **Database logs** for performance metrics

### Common Issues

#### Memory Errors
```
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
```

**Solution**: Increase memory allocation or use streaming approach

#### Timeout Errors
```
Job execution timed out
```

**Solution**: Increase timeout or break into smaller chunks

#### Database Connection Issues
```
Connection timeout
```

**Solution**: Check database configuration and connection limits

### Performance Metrics

Monitor these key metrics during stress testing:
- **Import rate** (products per minute)
- **Memory usage** (peak and average)
- **CPU utilization**
- **Database response time**
- **Error rate**

## Best Practices

### 1. Incremental Testing
- Start with smaller datasets (1K, 10K, 100K)
- Gradually increase to full scale
- Monitor performance at each level

### 2. Resource Planning
- Allocate sufficient memory and CPU
- Plan for extended execution times
- Consider database storage requirements

### 3. Data Management
- Clean up test data after testing
- Use separate test databases when possible
- Backup production data before testing

### 4. Monitoring
- Set up alerts for resource usage
- Monitor database performance
- Track error rates and response times

## Scripts Reference

### Generation Scripts

| Script | Description | Output |
|--------|-------------|--------|
| `generate:1m-products` | Generate 1M products CSV | `1-million-products.csv` |
| `generate:5m-products` | Generate 5M products CSV | `5-million-products.csv` |
| `generate:all-products` | Generate both 1M and 5M | Both CSV files |

### Import Scripts

| Script | Description | Input |
|--------|-------------|-------|
| `import:5m-products` | Import 5M products | `5-million-products.csv` |
| `import:chunk-1` | Import chunk 1 | `5-million-products.csv` |
| `import:chunk-2` | Import chunk 2 | `5-million-products.csv` |
| `import:chunk-3` | Import chunk 3 | `5-million-products.csv` |
| `import:chunk-4` | Import chunk 4 | `5-million-products.csv` |
| `import:chunk-5` | Import chunk 5 | `5-million-products.csv` |

## File Locations

- **Generated CSV files**: `static/assets/import/`
- **Generation scripts**: `src/strees-test/`
- **Import scripts**: `src/strees-test/`
- **Cloud Run Jobs**: Google Cloud Console

## Support

For issues or questions:
1. Check the logs for error messages
2. Verify resource allocation
3. Review database configuration
4. Contact the development team

## Related Documentation

- [Deployment Guide](DEPLOYMENT.md)
- [Elasticsearch Testing](ELASTICSEARCH_COMPREHENSIVE_TEST_GUIDE.md)
- [Clear Orders](CLEAR_ORDERS.md)
