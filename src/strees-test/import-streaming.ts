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
import * as readline from 'readline';
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
    console.log('🚀 Starting streaming product import...');
    
    const { app } = await bootstrapWorker(config);
    
    try {
        const ctx = await getSuperadminContext(app);
        const importer = app.get(Importer);
        const searchService = app.get(SearchService);
        
        const csvPath = path.join(__dirname, '../../static/assets/import/1-million-products.csv');
        console.log(`📁 Reading CSV file: ${csvPath}`);
        
        if (!fs.existsSync(csvPath)) {
            throw new Error(`CSV file not found: ${csvPath}`);
        }
        
        const importRows = await parseCSVWithStreaming(csvPath);
        
        console.log(`📊 Parsed ${importRows.length} products for import`);
        
        // Process in batches to avoid memory issues
        const batchSize = 1000;
        const totalBatches = Math.ceil(importRows.length / batchSize);
        
        console.log(`📦 Processing ${totalBatches} batches of ${batchSize} products each`);
        
        for (let i = 0; i < totalBatches; i++) {
            const start = i * batchSize;
            const end = Math.min(start + batchSize, importRows.length);
            const batch = importRows.slice(start, end);
            
            console.log(`📈 Processing batch ${i + 1}/${totalBatches} (products ${start + 1}-${end})`);
            
            await importer.importProducts(ctx, batch, progress => {
                const batchProgress = progress.imported - start;
                const percentage = Math.round((batchProgress / batch.length) * 100);
                console.log(`  📊 Batch progress: ${batchProgress}/${batch.length} products (${percentage}%)`);
            });
            
            // Force garbage collection between batches
            if (global.gc) {
                global.gc();
            }
        }
        
        console.log('🔄 Rebuilding search index...');
        await searchService.reindex(ctx);
        
        console.log('✅ Streaming import completed successfully!');
        
    } catch (error) {
        console.error('❌ Import failed:', error);
        throw error;
    } finally {
        await app.close();
    }
}

async function parseCSVWithStreaming(csvPath: string): Promise<ParsedProductWithVariants[]> {
    return new Promise((resolve, reject) => {
        const products: ParsedProductWithVariants[] = [];
        let currentProduct: ParsedProductWithVariants | null = null;
        let headers: string[] = [];
        let lineNumber = 0;
        
        const fileStream = fs.createReadStream(csvPath, { encoding: 'utf8' });
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });
        
        rl.on('line', (line) => {
            lineNumber++;
            
            if (lineNumber === 1) {
                // Parse headers
                headers = line.split(',').map(h => h.trim());
                return;
            }
            
            if (line.trim() === '') {
                return; // Skip empty lines
            }
            
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
                
                // Progress indicator
                if (lineNumber % 10000 === 0) {
                    console.log(`📊 Processed ${lineNumber} lines, found ${products.length} products`);
                }
                
            } catch (error) {
                console.warn(`⚠️  Error parsing line ${lineNumber}: ${error instanceof Error ? error.message : String(error)}`);
                // Continue processing other lines
            }
        });
        
        rl.on('close', () => {
            if (currentProduct) {
                products.push(currentProduct);
            }
            console.log(`📊 Finished parsing: ${lineNumber} lines, ${products.length} products`);
            resolve(products);
        });
        
        rl.on('error', (error) => {
            reject(error);
        });
    });
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
