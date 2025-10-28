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
    console.log('🚀 Starting OPTIMIZED products import...');
    
    const memUsage = process.memoryUsage();
    console.log(`💾 Initial memory usage: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB heap`);
    
    const { app } = await bootstrapWorker(config);
    
    try {
        const connection = app.get(TransactionalConnection);
        await connection.rawConnection.query('SELECT 1');
        console.log('✅ Database connection verified');
        
        const importer = app.get(Importer);
        await generateAndImportProductsBatched(importer, app);
        
        console.log('✅ Products import completed successfully!');
        
    } catch (error) {
        console.error('❌ Import failed:', error);
        throw error;
    } finally {
        await app.close();
    }
}

async function generateAndImportProductsBatched(importer: Importer, app: INestApplicationContext) {
    const TARGET_PRODUCTS = 50000;
    const BATCH_SIZE = 100; // 🚀 IMPORTANTE: Importar 100 productos por vez
    
    const categories = ['Electronics', 'Clothing', 'Home', 'Sports', 'Books'];
    const brands = ['BrandA', 'BrandB', 'BrandC', 'BrandD', 'BrandE'];
    
    let importedCount = 0;
    let errorCount = 0;
    const startTime = Date.now();
    
    console.log(`🎯 Target: Import ${TARGET_PRODUCTS.toLocaleString()} products in batches of ${BATCH_SIZE}`);
    
    const ctx = await getSuperadminContext(app);
    
    // Generar TODOS los productos primero (en memoria)
    const allProducts: ParsedProductWithVariants[] = [];
    console.log('📦 Generating product data in memory...');
    
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
                    description: `High-quality ${category.toLowerCase()} product from ${brand}.`,
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
        
        allProducts.push(product);
    }
    
    console.log(`✅ Generated ${allProducts.length.toLocaleString()} products in memory`);
    console.log('🚀 Starting batch import...\n');
    
    // Importar en BATCHES
    for (let i = 0; i < allProducts.length; i += BATCH_SIZE) {
        const batch = allProducts.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(allProducts.length / BATCH_SIZE);
        
        try {
            await importer.importProducts(ctx, batch, progress => {
                if (batchNumber % 10 === 0 || batchNumber <= 5) {
                    console.log(`   📊 Batch ${batchNumber}: ${progress.imported} products imported`);
                }
            });
            
            importedCount += batch.length;
            
            if (batchNumber % 10 === 0 || batchNumber <= 5) {
                const elapsed = Date.now() - startTime;
                const progress = (i / allProducts.length * 100).toFixed(1);
                const productsPerSecond = importedCount / (elapsed / 1000);
                const estimatedRemaining = ((allProducts.length - importedCount) / productsPerSecond / 60).toFixed(1);
                
                console.log(`✅ Batch ${batchNumber}/${totalBatches} completed`);
                console.log(`   - Products imported: ${importedCount.toLocaleString()} / ${TARGET_PRODUCTS.toLocaleString()}`);
                console.log(`   - Progress: ${progress}%`);
                console.log(`   - Speed: ${Math.round(productsPerSecond)} products/sec`);
                console.log(`   - Estimated time remaining: ${estimatedRemaining} minutes`);
                console.log('---');
            }
            
            // Memory management
            if (batchNumber % 100 === 0 && global.gc) {
                global.gc();
            }
            
        } catch (error) {
            errorCount += batch.length;
            console.error(`❌ Error in batch ${batchNumber}:`, error);
            // Continue with next batch
        }
    }
    
    const totalTime = Date.now() - startTime;
    const avgTimePerProduct = totalTime / importedCount;
    
    console.log('\n✅ Import completed!');
    console.log(`📊 Final Statistics:`);
    console.log(`   - Target: ${TARGET_PRODUCTS.toLocaleString()} products`);
    console.log(`   - Imported: ${importedCount.toLocaleString()}`);
    console.log(`   - Errors: ${errorCount}`);
    console.log(`   - Success rate: ${Math.round((importedCount / TARGET_PRODUCTS) * 100)}%`);
    console.log(`   - Total time: ${(totalTime / 1000 / 60).toFixed(1)} minutes`);
    console.log(`   - Average per product: ${avgTimePerProduct.toFixed(2)}ms`);
    console.log(`   - Products per minute: ${Math.round(importedCount / (totalTime / 1000 / 60))}`);
    console.log(`   - Batch size: ${BATCH_SIZE}`);
}

export async function getSuperadminContext(app: INestApplicationContext): Promise<RequestContext> {
    const { superadminCredentials } = app.get(ConfigService).authOptions;
    const superAdminUser = await app.get(TransactionalConnection)
        .getRepository(User)
        .findOneOrFail({ where: { identifier: superadminCredentials.identifier } });
    
    return new RequestContext({
        apiType: 'admin',
        channelOrToken: 'default-channel',
        languageCode: LanguageCode.en,
        user: superAdminUser,
            isAuthorized: true,
        authorizationMode: '__apiKey',
        trans: async (work) => {
            return work({} as any);
        },
    });
}

