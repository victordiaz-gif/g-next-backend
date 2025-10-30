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
    // 🚀 OPTIMIZACIONES PARA 1 MILLÓN DE PRODUCTOS EN 1 DÍA
    // Necesitamos ~11.5 productos/segundo = ~694 productos/minuto
    const TARGET_PRODUCTS = parseInt(process.env.TARGET_PRODUCTS || '1000000', 10);
    const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '500', 10); // 500 productos por batch (ajustable)
    const CONCURRENCY = parseInt(process.env.CONCURRENCY || '5', 10); // 5 batches en paralelo (ajustable)
    const GENERATION_CHUNK = parseInt(process.env.GENERATION_CHUNK || '5000', 10); // Generar 5k productos a la vez
    
    const categories = ['Electronics', 'Clothing', 'Home', 'Sports', 'Books', 'Automotive', 'Health', 'Beauty', 'Toys', 'Garden'];
    const brands = ['BrandA', 'BrandB', 'BrandC', 'BrandD', 'BrandE', 'BrandF', 'BrandG', 'BrandH', 'BrandI', 'BrandJ'];
    
    let importedCount = 0;
    let errorCount = 0;
    const startTime = Date.now();
    
    console.log(`🎯 Target: Import ${TARGET_PRODUCTS.toLocaleString()} products`);
    console.log(`⚙️  Configuration: BATCH_SIZE=${BATCH_SIZE}, CONCURRENCY=${CONCURRENCY}, GENERATION_CHUNK=${GENERATION_CHUNK}`);
    console.log(`📊 Expected speed: ~${BATCH_SIZE * CONCURRENCY} products per batch cycle\n`);
    
    // Get superadmin context once
    const ctx = await getSuperadminContext(app);
    
    // Función para generar un batch de productos (eficiente, sin cargar todo en memoria)
    function generateBatch(startIndex: number, batchSize: number): ParsedProductWithVariants[] {
        const batch: ParsedProductWithVariants[] = [];
        for (let i = 0; i < batchSize; i++) {
            const productIndex = startIndex + i;
            if (productIndex > TARGET_PRODUCTS) break;
            
            const category = categories[productIndex % categories.length];
            const brand = brands[productIndex % brands.length];
            const productName = `${category} Product ${productIndex}`;
            const slug = `product-${productIndex}`;
            
            batch.push({
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
                    sku: `SKU-${productIndex}`,
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
            });
        }
        return batch;
    }
    
    // Función para importar un batch
    async function importBatch(batchIndex: number, startIndex: number): Promise<{ success: number; errors: number }> {
        const batch = generateBatch(startIndex, BATCH_SIZE);
        try {
            await importer.importProducts(ctx, batch, () => {
                // Progress callback silencioso para mejor performance
            });
            return { success: batch.length, errors: 0 };
        } catch (error) {
            const errorMessage = (error as Error).message;
            // Solo loguear errores para primeros batches o cada 100th batch
            if (batchIndex <= 3 || batchIndex % 100 === 0) {
                console.error(`❌ Error importing batch ${batchIndex} (products ${startIndex}-${startIndex + batch.length - 1}):`, errorMessage);
            }
            return { success: 0, errors: batch.length };
        }
    }
    
    // Pool de concurrencia con control de batches en vuelo
    const runningBatches: Promise<{ success: number; errors: number }>[] = [];
    let currentIndex = 1;
    let batchNumber = 0;
    let lastProgressLog = 0;
    
    // Procesar batches con concurrencia controlada
    while (currentIndex <= TARGET_PRODUCTS || runningBatches.length > 0) {
        // Iniciar nuevos batches hasta alcanzar el límite de concurrencia
        while (runningBatches.length < CONCURRENCY && currentIndex <= TARGET_PRODUCTS) {
            const startIndex = currentIndex;
            const batchIndex = ++batchNumber;
            currentIndex += BATCH_SIZE;
            
            const batchPromise = importBatch(batchIndex, startIndex)
                .then(result => {
                    // Remover del array cuando termine
                    const index = runningBatches.indexOf(batchPromise);
                    if (index > -1) {
                        runningBatches.splice(index, 1);
                    }
                    return result;
                });
            
            runningBatches.push(batchPromise);
        }
        
        // Esperar a que termine al menos un batch
        if (runningBatches.length > 0) {
            const result = await Promise.race(runningBatches);
            importedCount += result.success;
            errorCount += result.errors;
            
            // Log progress cada cierto número de productos importados
            const totalProcessed = importedCount + errorCount;
            if (totalProcessed - lastProgressLog >= 10000 || batchNumber === 1) {
                lastProgressLog = totalProcessed;
                const elapsed = Date.now() - startTime;
                const productsPerSecond = totalProcessed / (elapsed / 1000);
                const productsPerMinute = productsPerSecond * 60;
                const remainingProducts = TARGET_PRODUCTS - totalProcessed;
                const estimatedTimeRemaining = remainingProducts / productsPerSecond / 60; // minutos
                
                console.log(`📈 Progress Report:`);
                console.log(`   - Processed: ${totalProcessed.toLocaleString()} / ${TARGET_PRODUCTS.toLocaleString()} products`);
                console.log(`   - Success: ${importedCount.toLocaleString()}, Errors: ${errorCount.toLocaleString()}`);
                console.log(`   - Progress: ${((totalProcessed / TARGET_PRODUCTS) * 100).toFixed(1)}%`);
                console.log(`   - Speed: ${Math.round(productsPerSecond)} products/sec (${Math.round(productsPerMinute)} products/min)`);
                console.log(`   - Estimated time remaining: ${estimatedTimeRemaining.toFixed(1)} minutes`);
                console.log(`   - Batches in flight: ${runningBatches.length}`);
                console.log(`   - Batches completed: ${batchNumber}`);
                console.log('---');
                
                // Garbage collection cada 50k productos
                if (totalProcessed % 50000 === 0 && global.gc) {
                    global.gc();
                    const memUsage = process.memoryUsage();
                    console.log(`   🗑️  Memory after GC: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB heap`);
                }
            }
        } else {
            // Pequeña pausa si no hay batches corriendo
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    }
    
    // Esperar a que terminen todos los batches pendientes
    if (runningBatches.length > 0) {
        const remainingResults = await Promise.all(runningBatches);
        for (const result of remainingResults) {
            importedCount += result.success;
            errorCount += result.errors;
        }
    }
    
    const totalTime = Date.now() - startTime;
    const totalProcessed = importedCount + errorCount;
    const avgTimePerProduct = totalTime / totalProcessed;
    const productsPerSecond = totalProcessed / (totalTime / 1000);
    const productsPerMinute = productsPerSecond * 60;
    const successRate = totalProcessed > 0 ? Math.round((importedCount / totalProcessed) * 100) : 0;
    
    console.log('\n✅ Products import completed!');
    console.log(`📊 Final Statistics:`);
    console.log(`   - Target products: ${TARGET_PRODUCTS.toLocaleString()}`);
    console.log(`   - Products imported: ${importedCount.toLocaleString()}`);
    console.log(`   - Errors: ${errorCount.toLocaleString()}`);
    console.log(`   - Success rate: ${successRate}%`);
    console.log(`   - Total time: ${(totalTime / 1000 / 60).toFixed(1)} minutes (${(totalTime / 1000 / 3600).toFixed(2)} hours)`);
    console.log(`   - Average time per product: ${avgTimePerProduct.toFixed(2)}ms`);
    console.log(`   - Speed: ${Math.round(productsPerSecond)} products/sec (${Math.round(productsPerMinute)} products/min)`);
    console.log(`   - Configuration: BATCH_SIZE=${BATCH_SIZE}, CONCURRENCY=${CONCURRENCY}`);
    console.log(`   - Total batches: ${batchNumber}`);
    
    // Calcular tiempo estimado para 1 millón
    if (productsPerSecond > 0) {
        const timeFor1M = 1000000 / productsPerSecond / 3600; // horas
        console.log(`\n⏱️  At this speed, 1M products would take: ${timeFor1M.toFixed(2)} hours`);
        if (timeFor1M <= 24) {
            console.log(`   ✅ Feasible: Can complete 1M products in ${timeFor1M.toFixed(2)} hours (< 24h)`);
        } else {
            console.log(`   ⚠️  Not feasible: Would take ${timeFor1M.toFixed(2)} hours (> 24h)`);
            console.log(`   💡 Suggestions: Increase BATCH_SIZE to ${BATCH_SIZE * 2} or CONCURRENCY to ${CONCURRENCY + 2}`);
        }
    }
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
