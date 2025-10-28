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
    console.log('🚀 Starting FAST products import (batches of 1000)...');
    
    const memUsage = process.memoryUsage();
    console.log(`💾 Initial memory usage: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB heap, ${Math.round(memUsage.rss / 1024 / 1024)}MB RSS`);
    
    const { app } = await bootstrapWorker(config);
    
    try {
        console.log('🔍 Testing database connection...');
        const connection = app.get(TransactionalConnection);
        await connection.rawConnection.query('SELECT 1');
        console.log('✅ Database connection verified');
        
        const importer = app.get(Importer);
        await generateAndImportProductsInBatches(importer, app);
        
        console.log('✅ Products import completed successfully!');
        
    } catch (error) {
        console.error('❌ Import failed:', error);
        throw error;
    } finally {
        await app.close();
        
        const finalMemUsage = process.memoryUsage();
        console.log(`💾 Final memory usage: ${Math.round(finalMemUsage.heapUsed / 1024 / 1024)}MB heap, ${Math.round(finalMemUsage.rss / 1024 / 1024)}MB RSS`);
    }
}

async function generateAndImportProductsInBatches(importer: Importer, app: INestApplicationContext) {
    const TARGET_PRODUCTS = 50000;
    const BATCH_SIZE = 1000; // 🚀 IMPORTANTE: Importar 1000 productos por vez
    
    const categories = ['Electronics', 'Clothing', 'Home', 'Sports', 'Books', 'Automotive', 'Health', 'Beauty', 'Toys', 'Garden'];
    const brands = ['BrandA', 'BrandB', 'BrandC', 'BrandD', 'BrandE', 'BrandF', 'BrandG', 'BrandH', 'BrandI', 'BrandJ'];
    
    let importedCount = 0;
    let errorCount = 0;
    const startTime = Date.now();
    
    console.log(`🎯 Target: Import ${TARGET_PRODUCTS.toLocaleString()} products in batches of ${BATCH_SIZE}`);
    console.log(`📊 This will create ${Math.ceil(TARGET_PRODUCTS / BATCH_SIZE)} transactions instead of ${TARGET_PRODUCTS}\n`);
    
    // Get superadmin context once
    const ctx = await getSuperadminContext(app);
    
    // PASO 1: Generar TODOS los productos en memoria
    console.log('📦 Generating all products in memory...');
    const allProducts: ParsedProductWithVariants[] = [];
    
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
        
        allProducts.push(product);
    }
    
    console.log(`✅ Generated ${allProducts.length.toLocaleString()} products in memory`);
    console.log(`📊 Starting batch import of ${Math.ceil(allProducts.length / BATCH_SIZE)} batches...\n`);
    
    // PASO 2: Procesar en lotes de 1000
    for (let i = 0; i < allProducts.length; i += BATCH_SIZE) {
        const batch = allProducts.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(allProducts.length / BATCH_SIZE);
        
        const batchStartTime = Date.now();
        
        try {
            console.log(`📦 Importing batch ${batchNumber}/${totalBatches} (${batch.length} products)...`);
            
            await importer.importProducts(ctx, batch, progress => {
                // Mostrar progreso solo en algunos batches
                if (batchNumber % 10 === 0 || batchNumber <= 3) {
                    console.log(`   📊 Progress in batch ${batchNumber}: ${progress.imported} products imported`);
                }
            });
            
            const batchTime = Date.now() - batchStartTime;
            importedCount += batch.length;
            
            console.log(`✅ Batch ${batchNumber}/${totalBatches} completed in ${(batchTime / 1000).toFixed(1)}s`);
            
            // Mostrar estadísticas cada 10 batches
            if (batchNumber % 10 === 0 || batchNumber <= 3) {
                const elapsed = Date.now() - startTime;
                const progress = (i / allProducts.length * 100).toFixed(1);
                const productsPerSecond = importedCount / (elapsed / 1000);
                const estimatedRemaining = ((allProducts.length - importedCount) / productsPerSecond / 60).toFixed(1);
                
                console.log(`📈 Progress Report:`);
                console.log(`   - Imported: ${importedCount.toLocaleString()} / ${TARGET_PRODUCTS.toLocaleString()} products`);
                console.log(`   - Progress: ${progress}%`);
                console.log(`   - Speed: ${Math.round(productsPerSecond)} products/sec`);
                console.log(`   - Errors: ${errorCount}`);
                console.log(`   - Estimated time remaining: ${estimatedRemaining} minutes`);
                console.log('---\n');
            }
            
            // Garbage collection cada 10 batches
            if (batchNumber % 10 === 0 && global.gc) {
                global.gc();
                const memUsage = process.memoryUsage();
                console.log(`   🗑️  Memory after GC: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB heap`);
            }
            
        } catch (error) {
            errorCount += batch.length;
            console.error(`❌ Error in batch ${batchNumber}:`, (error as Error).message);
            console.error(`   Skipping ${batch.length} products in this batch`);
            // Continue with next batch
        }
    }
    
    const totalTime = Date.now() - startTime;
    const avgTimePerProduct = totalTime / importedCount;
    
    console.log('\n✅ Import completed!');
    console.log('📊 Final Statistics:');
    console.log(`   - Target products: ${TARGET_PRODUCTS.toLocaleString()}`);
    console.log(`   - Products imported: ${importedCount.toLocaleString()}`);
    console.log(`   - Errors: ${errorCount}`);
    console.log(`   - Success rate: ${Math.round((importedCount / TARGET_PRODUCTS) * 100)}%`);
    console.log(`   - Total time: ${(totalTime / 1000 / 60).toFixed(1)} minutes`);
    console.log(`   - Average time per product: ${avgTimePerProduct.toFixed(2)}ms`);
    console.log(`   - Products per minute: ${Math.round(importedCount / (totalTime / 1000 / 60))}`);
    console.log(`   - Batches processed: ${Math.ceil(allProducts.length / BATCH_SIZE)}`);
    console.log(`   - Average products per batch: ${BATCH_SIZE}`);
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

