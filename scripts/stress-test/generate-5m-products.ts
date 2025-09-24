import * as fs from 'fs';
import * as path from 'path';

if (require.main === module) {
    generateCSV().then(
        () => process.exit(0),
        err => {
            console.error('CSV generation failed:', err);
            process.exit(1);
        },
    );
}

async function generateCSV() {
    console.log('🚀 Generating 5M products CSV file...');
    
    const outputDir = path.join(__dirname, '../../static/assets/import');
    const outputFile = path.join(outputDir, '5-million-products.csv');
    
    // Ensure directory exists
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // CSV headers
    const headers = [
        'name',
        'slug', 
        'description',
        'assets',
        'facets',
        'optionGroups',
        'optionValues',
        'sku',
        'price',
        'taxCategory',
        'stockOnHand',
        'trackInventory',
        'variantAssets',
        'variantFacets'
    ];
    
    // Create write stream
    const writeStream = fs.createWriteStream(outputFile);
    
    // Write headers
    writeStream.write(headers.join(',') + '\n');
    
    const totalProducts = 5000000; // 5 million products
    const variantsPerProduct = 3; // 3 variants per product on average
    const batchSize = 1000; // Write in batches of 1000 products
    
    console.log(`📊 Generating ${totalProducts} products with ${variantsPerProduct} variants each...`);
    
    let productCount = 0;
    let variantCount = 0;
    
    // Categories for realistic data
    const categories = [
        'Electronics', 'Clothing', 'Home & Garden', 'Sports', 'Books',
        'Toys', 'Beauty', 'Automotive', 'Health', 'Office'
    ];
    
    const brands = [
        'Apple', 'Samsung', 'Nike', 'Adidas', 'Sony', 'Microsoft',
        'Google', 'Amazon', 'Tesla', 'BMW', 'Toyota', 'Honda'
    ];
    
    const colors = ['Red', 'Blue', 'Green', 'Black', 'White', 'Silver', 'Gold'];
    const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
    
    for (let i = 0; i < totalProducts; i += batchSize) {
        const batch = [];
        const currentBatchSize = Math.min(batchSize, totalProducts - i);
        
        for (let j = 0; j < currentBatchSize; j++) {
            const productIndex = i + j;
            const category = categories[productIndex % categories.length];
            const brand = brands[productIndex % brands.length];
            
            // Generate product data
            const productName = `${category} Product ${productIndex + 1}`;
            const productSlug = `product-${productIndex + 1}`;
            const productDescription = `High-quality ${category.toLowerCase()} product from ${brand}. Perfect for everyday use.`;
            
            // Generate variants for this product
            const numVariants = Math.floor(Math.random() * 3) + 1; // 1-3 variants
            
            for (let v = 0; v < numVariants; v++) {
                const color = colors[v % colors.length];
                const size = sizes[v % sizes.length];
                const variantName = `${productName} - ${color} ${size}`;
                const sku = `SKU-${productIndex + 1}-${v + 1}`;
                const price = (Math.random() * 1000 + 10).toFixed(2);
                const stock = Math.floor(Math.random() * 1000) + 10;
                
                const row = [
                    v === 0 ? productName : '', // Only first variant has product name
                    v === 0 ? productSlug : '', // Only first variant has slug
                    v === 0 ? productDescription : '', // Only first variant has description
                    v === 0 ? `product-${productIndex + 1}-main.jpg` : '', // Only first variant has assets
                    v === 0 ? `category:${category}|brand:${brand}` : '', // Only first variant has facets
                    v === 0 ? 'Color|Size' : '', // Only first variant has option groups
                    `${color}|${size}`, // All variants have option values
                    sku,
                    price,
                    'standard',
                    stock.toString(),
                    'true',
                    '', // variantAssets
                    ''  // variantFacets
                ];
                
                batch.push(row.map(field => `"${field}"`).join(','));
                variantCount++;
            }
            
            productCount++;
        }
        
        // Write batch to file
        writeStream.write(batch.join('\n') + '\n');
        
        // Progress update
        if (productCount % 10000 === 0) {
            console.log(`📈 Generated ${productCount} products (${variantCount} variants)...`);
        }
    }
    
    writeStream.end();
    
    console.log('✅ CSV generation completed!');
    console.log(`📊 Total products: ${productCount}`);
    console.log(`📊 Total variants: ${variantCount}`);
    console.log(`📁 File saved to: ${outputFile}`);
    console.log(`📏 File size: ${(fs.statSync(outputFile).size / 1024 / 1024).toFixed(2)} MB`);
}

export { generateCSV };
