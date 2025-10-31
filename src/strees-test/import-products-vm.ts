// CRITICAL: reflect-metadata MUST be imported first, before any other imports
import 'reflect-metadata';
import { INestApplicationContext } from '@nestjs/common';
import {
    bootstrapWorker,
    ConfigService,
    Importer,
    LanguageCode,
    ParsedProductWithVariants,
    RequestContext,
    RequestContextService,
    TransactionalConnection,
    User,
} from '@vendure/core';
import { config } from '../vendure-config';

if (require.main === module) {
    importData().then(
        () => process.exit(0),
        err => {
            console.error('Import failed:', err);
            process.exit(1);
        },
    );
}

async function importData() {
    console.log('🚀 Starting products import...');
    
    // Log memory usage at start
    const memUsage = process.memoryUsage();
    console.log(`💾 Initial memory usage: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB heap, ${Math.round(memUsage.rss / 1024 / 1024)}MB RSS`);
    
    const { app } = await bootstrapWorker(config);
    
    try {
        // Test database connection first
        console.log('🔍 Testing database connection...');
        const connection = app.get(TransactionalConnection);
        await connection.rawConnection.query('SELECT 1');
        console.log('✅ Database connection verified');
        
        const importer = app.get(Importer);
        
        // Generate products
        await generateAndImportProducts(importer, app);
        
        console.log('✅ Products import completed successfully!');
        
    } catch (error) {
        console.error('❌ Import failed:', error);
        throw error;
    } finally {
        await app.close();
        
        // Log final memory usage
        const finalMemUsage = process.memoryUsage();
        console.log(`💾 Final memory usage: ${Math.round(finalMemUsage.heapUsed / 1024 / 1024)}MB heap, ${Math.round(finalMemUsage.rss / 1024 / 1024)}MB RSS`);
    }
}

async function generateAndImportProducts(importer: Importer, app: INestApplicationContext) {
    // 🚀 VM Version: Supports environment variables for flexibility
    // Default values: 50000 (same as original)
    const TARGET_PRODUCTS = parseInt(process.env.TARGET_PRODUCTS || '50000', 10);
    const categories = ['Electronics', 'Clothing', 'Home', 'Sports', 'Books', 'Automotive', 'Health', 'Beauty', 'Toys', 'Garden'];
    const brands = ['BrandA', 'BrandB', 'BrandC', 'BrandD', 'BrandE', 'BrandF', 'BrandG', 'BrandH', 'BrandI', 'BrandJ'];
    
    let importedCount = 0;
    let errorCount = 0;
    const startTime = Date.now();
    
    console.log(`🎯 Target: Import ${TARGET_PRODUCTS.toLocaleString()} products`);
    
    // Get superadmin context once
    const ctx = await getSuperadminContext(app);
    
    for (let i = 1; i <= TARGET_PRODUCTS; i++) {
        const category = categories[i % categories.length];
        const brand = brands[i % brands.length];
        const productName = `${category} Product ${i}`;
        const slug = `product-${i}`;
        
        const product: ParsedProductWithVariants = {
            product: {
                translations: [{
                    languageCode: LanguageCode.en,
                    name: productName,
                    slug: slug,
                    description: `High-quality ${category.toLowerCase()} product from ${brand}. Perfect for everyday use.`,
                    customFields: {},
                }],
                assetPaths: [],
                facets: [
                    {
                        translations: [{
                            languageCode: LanguageCode.en,
                            facet: 'category',
                            value: category
                        }]
                    },
                    {
                        translations: [{
                            languageCode: LanguageCode.en,
                            facet: 'brand',
                            value: brand
                        }]
                    }
                ],
                optionGroups: [],
            },
            variants: [{
                sku: `SKU-${i}`,
                price: Math.round((Math.random() * 100 + 10) * 100) / 100,
                stockOnHand: Math.floor(Math.random() * 1000) + 10,
                trackInventory: 'TRUE' as any,
                taxCategory: 'standard',
                assetPaths: [],
                facets: [],
                translations: [{
                    languageCode: LanguageCode.en,
                    optionValues: [],
                    customFields: {},
                }],
            }],
        };
        
        try {
            await importer.importProducts(ctx, [product], () => {
                // Progress callback
            });
            importedCount++;
        } catch (error) {
            errorCount++;
            const errorMessage = (error as Error).message;
            
            // Only log errors for first 10 products or every 1000th error
            if (i <= 10 || errorCount % 1000 === 0) {
                console.error(`❌ Error importing product ${i}:`, errorMessage);
            }
            
            // Continue with next product instead of stopping
        }
        
        // Progress logging every 1000 products
        if (i % 1000 === 0) {
            const elapsed = Date.now() - startTime;
            const productsPerSecond = i / (elapsed / 1000);
            const remainingProducts = TARGET_PRODUCTS - i;
            const estimatedTimeRemaining = remainingProducts / productsPerSecond / 60; // minutes
            
            console.log(`📈 Progress Report:`);
            console.log(`   - Imported: ${i.toLocaleString()} / ${TARGET_PRODUCTS.toLocaleString()} products`);
            console.log(`   - Progress: ${((i / TARGET_PRODUCTS) * 100).toFixed(1)}%`);
            console.log(`   - Speed: ${Math.round(productsPerSecond)} products/sec`);
            console.log(`   - Estimated time remaining: ${estimatedTimeRemaining.toFixed(1)} minutes`);
            console.log(`   - Success: ${importedCount.toLocaleString()}, Errors: ${errorCount.toLocaleString()}`);
            console.log('---');
            
            // Garbage collection every 10k products
            if (i % 10000 === 0 && global.gc) {
                global.gc();
                const memUsage = process.memoryUsage();
                console.log(`   🗑️  Memory after GC: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB heap`);
            }
        }
    }
    
    const totalTime = Date.now() - startTime;
    const avgTimePerProduct = totalTime / importedCount;
    
    console.log('✅ Products import completed!');
    console.log(`📊 Final Statistics:`);
    console.log(`   - Target products: ${TARGET_PRODUCTS.toLocaleString()}`);
    console.log(`   - Products imported: ${importedCount.toLocaleString()}`);
    console.log(`   - Errors: ${errorCount}`);
    console.log(`   - Success rate: ${Math.round(((importedCount - errorCount) / importedCount) * 100)}%`);
    console.log(`   - Total time: ${(totalTime / 1000 / 60).toFixed(1)} minutes`);
    console.log(`   - Average time per product: ${avgTimePerProduct.toFixed(2)}ms`);
    console.log(`   - Products per minute: ${Math.round((importedCount / (totalTime / 1000 / 60)))}`);
}

export async function getSuperadminContext(app: INestApplicationContext): Promise<RequestContext> {
    const { superadminCredentials } = app.get(ConfigService).authOptions;
    const superAdminUser = await app.get(TransactionalConnection)
        .getRepository(User)
        .findOneOrFail({ where: { identifier: superadminCredentials.identifier } });
    return app.get(RequestContextService).create({
        apiType: 'admin',
        user: superAdminUser,
    });
}

