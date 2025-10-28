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
import { config } from '../../src/vendure-config';

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
    console.log('🚀 Starting 1000 products import...');
    
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
        
        // Generate 1000 products
        await generateAndImport1000Products(importer, app);
        
        console.log('✅ 1000 products import completed successfully!');
        
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

async function generateAndImport1000Products(importer: Importer, app: INestApplicationContext) {
    const TARGET_PRODUCTS = 1000;
    const categories = ['Electronics', 'Clothing', 'Home', 'Sports', 'Books', 'Automotive', 'Health', 'Beauty', 'Toys', 'Garden'];
    const brands = ['BrandA', 'BrandB', 'BrandC', 'BrandD', 'BrandE', 'BrandF', 'BrandG', 'BrandH', 'BrandI', 'BrandJ'];
    
    let importedCount = 0;
    let errorCount = 0;
    const startTime = Date.now();
    
    console.log(`🎯 Target: Import ${TARGET_PRODUCTS.toLocaleString()} products`);
    
    // Get superadmin context once
    const ctx = await getSuperadminContext(app);
    
    for (let i = 1; i <= TARGET_PRODUCTS; i++) {
        try {
            const category = categories[i % categories.length];
            const brand = brands[i % brands.length];
            const productName = `${category} Product ${i}`;
            const slug = `product-${i}`;
            
            // Create a simple product with one variant
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
                    price: Math.round((Math.random() * 100 + 10) * 100) / 100, // Random price between $10-$110
                    stockOnHand: Math.floor(Math.random() * 1000) + 10, // Random stock between 10-1010
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
            
            console.log(`📦 Importing product ${i}: "${productName}"`);
            
            // Import the single product
            await importer.importProducts(ctx, [product], progress => {
                console.log(`   📊 Progress: ${progress.imported} products imported`);
            });
            
            importedCount++;
            console.log(`   🎉 Product ${i} completed successfully!`);
            
            // Show progress every 100 products
            if (i % 100 === 0) {
                const elapsed = Date.now() - startTime;
                const avgTimePerProduct = elapsed / i;
                const remainingProducts = TARGET_PRODUCTS - i;
                const estimatedTimeRemaining = (remainingProducts * avgTimePerProduct) / 1000 / 60; // in minutes
                
                console.log(`📈 Progress Report:`);
                console.log(`   - Imported: ${i.toLocaleString()} / ${TARGET_PRODUCTS.toLocaleString()} products`);
                console.log(`   - Progress: ${((i / TARGET_PRODUCTS) * 100).toFixed(1)}%`);
                console.log(`   - Errors: ${errorCount}`);
                console.log(`   - Estimated time remaining: ${estimatedTimeRemaining.toFixed(1)} minutes`);
                console.log(`   - Average time per product: ${avgTimePerProduct.toFixed(2)}ms`);
                console.log('---');
            }
            
            // Force garbage collection every 50 products
            if (i % 50 === 0 && global.gc) {
                global.gc();
                const memUsage = process.memoryUsage();
                console.log(`   🗑️  Memory after GC: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB heap`);
            }
            
        } catch (error) {
            errorCount++;
            console.error(`❌ Error importing product ${i}:`, (error as Error).message);
            
            // Continue with next product instead of stopping
        }
    }
    
    const totalTime = Date.now() - startTime;
    const avgTimePerProduct = totalTime / importedCount;
    
    console.log('✅ 1000 products import completed!');
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
