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
    SearchService,
    ID,
} from '@vendure/core';
import { config } from '../../src/vendure-config';
import * as fs from 'fs';
import * as path from 'path';
import { GlobalFlag } from '../plugins/multivendor/gql/generated';

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
    console.log('🚀 Starting 100K products chunked import...');
    
    const { app } = await bootstrapWorker(config);
    
    try {
        const ctx = await getSuperadminContext(app);
        const importer = app.get(Importer);
        const searchService = app.get(SearchService);
        
        const csvPath = path.join(__dirname, '../../static/assets/import/100k-products.csv');
        console.log(`📁 Reading CSV file: ${csvPath}`);
        
        if (!fs.existsSync(csvPath)) {
            throw new Error(`CSV file not found: ${csvPath}`);
        }
        
        await processCSVChunked(csvPath, importer, ctx);
        
        console.log('🔄 Rebuilding search index...');
        await searchService.reindex(ctx);
        
        console.log('✅ 100K products chunked import completed successfully!');
        
    } catch (error) {
        console.error('❌ Import failed:', error);
        throw error;
    } finally {
        await app.close();
    }
}

async function processCSVChunked(csvPath: string, importer: Importer, ctx: RequestContext) {
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    const dataLines = lines.slice(1);
    
    console.log(`📊 Total lines to process: ${dataLines.length}`);
    
    const chunkSize = 1000; // Process 1000 lines at a time
    let totalProcessed = 0;
    
    for (let i = 0; i < dataLines.length; i += chunkSize) {
        const chunk = dataLines.slice(i, i + chunkSize);
        console.log(`📦 Processing chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(dataLines.length / chunkSize)} (${chunk.length} lines)`);
        
        const products = parseChunkToProducts(chunk, headers);
        
        if (products.length > 0) {
            console.log(`📦 Importing ${products.length} products...`);
            
            await importer.importProducts(ctx, products, progress => {
                const percentage = Math.round((progress.imported / products.length) * 100);
                if (progress.imported % 50 === 0) {
                    console.log(`  📊 Progress: ${progress.imported}/${products.length} products (${percentage}%)`);
                }
            });
            
            totalProcessed += products.length;
            console.log(`✅ Chunk completed! Total processed: ${totalProcessed} products`);
            
            // Force garbage collection
            if (global.gc) {
                global.gc();
            }
        }
    }
    
    console.log(`📊 Finished processing: ${totalProcessed} products total`);
}

function parseChunkToProducts(chunk: string[], headers: string[]): ParsedProductWithVariants[] {
    const products: ParsedProductWithVariants[] = [];
    let currentProduct: ParsedProductWithVariants | null = null;
    
    for (const line of chunk) {
        if (line.trim() === '') continue;
        
        try {
            const values = parseCSVRow(line);
            const rowData = headers.reduce((obj, header, index) => {
                obj[header] = values[index] || '';
                return obj;
            }, {} as any);
            
            if (rowData.name) {
                if (currentProduct) {
                    products.push(currentProduct);
                }
                
                currentProduct = {
                    product: {
                        translations: [{
                            languageCode: LanguageCode.en,
                            name: rowData.name,
                            slug: rowData.slug || generateSlug(rowData.name),
                            description: rowData.description || '',
                            customFields: {},
                        }],
                        assetPaths: rowData.assets ? rowData.assets.split('|').filter(Boolean) : [],
                        facets: parseFacets(rowData.facets),
                        optionGroups: parseOptionGroups(rowData.optionGroups),
                    },
                    variants: [],
                };
            }
            
            if (currentProduct && rowData.sku) {
                currentProduct.variants.push({
                    sku: rowData.sku,
                    price: parseFloat(rowData.price) || 0,
                    stockOnHand: parseInt(rowData.stockOnHand) || 0,
                    trackInventory: rowData.trackInventory === 'true' ? GlobalFlag.TRUE : GlobalFlag.FALSE,
                    taxCategory: rowData.taxCategory || 'standard',
                    assetPaths: rowData.variantAssets ? rowData.variantAssets.split('|').filter(Boolean) : [],
                    facets: parseFacets(rowData.variantFacets),
                    translations: [{
                        languageCode: LanguageCode.en,
                        optionValues: parseOptionValues(rowData.optionValues),
                        customFields: {},
                    }],
                });
            }
        } catch (error) {
            console.warn(`⚠️  Error parsing line: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    
    if (currentProduct) {
        products.push(currentProduct);
    }
    
    return products;
}

function parseCSVRow(row: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < row.length; i++) {
        const char = row[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    
    result.push(current.trim());
    return result;
}

function parseFacets(facetsStr: string): Array<{ name: string; value: string; translations: Array<{ languageCode: LanguageCode; facet: string; value: string }> }> {
    if (!facetsStr) return [];
    
    return facetsStr.split('|').map(facet => {
        const [name, value] = facet.split(':');
        return { 
            name: name?.trim(), 
            value: value?.trim(),
            translations: [{
                languageCode: LanguageCode.en,
                facet: name?.trim(),
                value: value?.trim()
            }]
        };
    }).filter(f => f.name && f.value);
}

function parseOptionGroups(optionGroupsStr: string): Array<{ translations: Array<{ languageCode: LanguageCode; name: string; values: string[] }> }> {
    if (!optionGroupsStr) return [];
    
    return optionGroupsStr.split('|').map(group => ({
        translations: [{
            languageCode: LanguageCode.en,
            name: group.trim(),
            values: [],
        }],
    }));
}

function parseOptionValues(optionValuesStr: string): string[] {
    if (!optionValuesStr) return [];
    return optionValuesStr.split('|').map(v => v.trim()).filter(Boolean);
}

function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
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
