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
    console.log('🚀 Starting 50,000 products import...');
    
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
        
        // Generate 50,000 products
        await generateAndImport50kProducts(importer, app);
        
        console.log('✅ 50,000 products import completed successfully!');
        
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

async function generateAndImport50kProducts(importer: Importer, app: INestApplicationContext) {
    const TARGET_PRODUCTS = 50000;
    const categories = ['Electronics', 'Clothing', 'Home', 'Sports', 'Books', 'Automotive', 'Health', 'Beauty', 'Toys', 'Garden', 'Office', 'Kitchen', 'Outdoor', 'Fitness', 'Music'];
    const brands = ['BrandA', 'BrandB', 'BrandC', 'BrandD', 'BrandE', 'BrandF', 'BrandG', 'BrandH', 'BrandI', 'BrandJ', 'BrandK', 'BrandL', 'BrandM', 'BrandN', 'BrandO'];
    const colors = ['Red', 'Blue', 'Green', 'Black', 'White', 'Yellow', 'Purple', 'Orange', 'Pink', 'Gray'];
    const materials = ['Cotton', 'Polyester', 'Leather', 'Metal', 'Plastic', 'Wood', 'Glass', 'Ceramic', 'Silk', 'Wool'];
    
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
            const color = colors[i % colors.length];
            const material = materials[i % colors.length];
            
            // Create more diverse product names
            const productName = `${category} ${material} ${color} Product ${i}`;
            const slug = `product-${category.toLowerCase()}-${i}`;
            
            // Create a simple product with one variant
            const product: ParsedProductWithVariants = {
                product: {
                    translations: [{
                        languageCode: LanguageCode.en,
                        name: productName,
                        slug: slug,
                        description: `High-quality ${material.toLowerCase()} ${category.toLowerCase()} product from ${brand}. Available in ${color.toLowerCase()} color. Perfect for everyday use with premium quality materials.`,
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
                        },
                        {
                            translations: [{
                                languageCode: LanguageCode.en,
                                facet: 'color',
                                value: color
                            }]
                        },
                        {
                            translations: [{
                                languageCode: LanguageCode.en,
                                facet: 'material',
                                value: material
                            }]
                        }
                    ],
                    optionGroups: [],
                },
                variants: [{
                    sku: `${brand.toUpperCase()}-${category.substring(0,3).toUpperCase()}-${i}`,
                    price: Math.round((Math.random() * 200 + 5) * 100) / 100, // Random price between $5-$205
                    stockOnHand: Math.floor(Math.random() * 2000) + 5, // Random stock between 5-2005
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
            
            // Only log every 1000 products to reduce console spam
            if (i % 1000 === 0 || i <= 10) {
                console.log(`📦 Importing product ${i}: "${productName}"`);
            }
            
            // Import the single product with timeout
            const importPromise = importer.importProducts(ctx, [product], progress => {
                if (i % 1000 === 0 || i <= 10) {
                    console.log(`   📊 Progress: ${progress.imported} products imported`);
                }
            });
            
            // Add timeout to prevent hanging
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Import timeout after 30 seconds')), 30000);
            });
            
            await Promise.race([importPromise, timeoutPromise]);
            
            importedCount++;
            
            if (i % 1000 === 0 || i <= 10) {
                console.log(`   🎉 Product ${i} completed successfully!`);
            }
            
            // Show progress every 5000 products
            if (i % 5000 === 0) {
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
                console.log(`   - Products per minute: ${Math.round((i / (elapsed / 1000 / 60)))}`);
                console.log('---');
            }
            
            // Force garbage collection every 1000 products
            if (i % 1000 === 0 && global.gc) {
                global.gc();
                const memUsage = process.memoryUsage();
                console.log(`   🗑️  Memory after GC: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB heap`);
            }
            
        } catch (error) {
            errorCount++;
            const errorMessage = (error as Error).message;
            
            // Only log errors for first 10 products or every 1000th error
            if (i <= 10 || errorCount % 1000 === 0) {
                console.error(`❌ Error importing product ${i}:`, errorMessage);
            }
            
            // If too many consecutive errors, wait and retry
            if (errorCount > 0 && errorCount % 10 === 0) {
                console.log(`   ⏳ Too many errors, waiting 5 seconds before continuing...`);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
            
            // Continue with next product instead of stopping
        }
    }
    
    const totalTime = Date.now() - startTime;
    const avgTimePerProduct = totalTime / importedCount;
    
    console.log('✅ 50,000 products import completed!');
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
