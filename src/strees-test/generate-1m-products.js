const fs = require('fs');
const path = require('path');

async function generateCSV() {
    console.log('🚀 Generating 1M products CSV file...');
    
    const outputDir = path.join(__dirname, '../../static/assets/import');
    const outputFile = path.join(outputDir, '1-million-products.csv');
    
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
    
    const totalProducts = 1000000; // 1 million products
    const variantsPerProduct = 3; // 3 variants per product
    
    console.log(`📊 Generating ${totalProducts} products with ${variantsPerProduct} variants each...`);
    
    let productCount = 0;
    let variantCount = 0;
    
    // Categories for realistic data
    const categories = ['Electronics', 'Clothing', 'Home', 'Sports', 'Books', 'Toys', 'Beauty', 'Automotive'];
    const brands = ['BrandA', 'BrandB', 'BrandC', 'BrandD', 'BrandE'];
    const colors = ['Red', 'Blue', 'Green', 'Black', 'White'];
    const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
    
    for (let productIndex = 0; productIndex < totalProducts; productIndex++) {
        const category = categories[productIndex % categories.length];
        const brand = brands[productIndex % brands.length];
        
        // Generate product data
        const productName = `${category} Product ${productIndex + 1}`;
        const productSlug = `product-${productIndex + 1}`;
        const productDescription = `High-quality ${category.toLowerCase()} product from ${brand}. Perfect for everyday use.`;
        
        // Product row (only first variant)
        const productRow = [
            productName,
            productSlug,
            productDescription,
            `product-${productIndex + 1}-main.jpg`,
            `category:${category}|brand:${brand}`,
            'Color|Size',
            '', // optionValues for product
            '', // sku for product
            '', // price for product
            '', // taxCategory for product
            '', // stockOnHand for product
            '', // trackInventory for product
            '', // variantAssets for product
            ''  // variantFacets for product
        ];
        
        writeStream.write(productRow.map(field => `"${field}"`).join(',') + '\n');
        
        // Variant rows
        for (let v = 0; v < variantsPerProduct; v++) {
            const color = colors[v % colors.length];
            const size = sizes[v % sizes.length];
            const sku = `SKU-${productIndex + 1}-${color}-${size}`;
            const price = (10 + (v * 2)).toFixed(2);
            const stock = 100 + (v * 10);
            
            const variantRow = [
                '', // name
                '', // slug
                '', // description
                '', // assets
                '', // facets
                '', // optionGroups
                `${color}|${size}`, // optionValues
                sku,
                price,
                'standard',
                stock.toString(),
                'true',
                '', // variantAssets
                ''  // variantFacets
            ];
            
            writeStream.write(variantRow.map(field => `"${field}"`).join(',') + '\n');
            variantCount++;
        }
        
        productCount++;
        
        // Progress update
        if (productCount % 100000 === 0) {
            console.log(`📈 Generated ${productCount} products (${variantCount} variants)...`);
        }
    }
    
    writeStream.end();
    
    // Wait for the stream to finish writing
    await new Promise((resolve, reject) => {
        writeStream.on('finish', () => resolve());
        writeStream.on('error', reject);
    });
    
    console.log('✅ CSV generation completed!');
    console.log(`📊 Total products: ${productCount}`);
    console.log(`📊 Total variants: ${variantCount}`);
    console.log(`📁 File saved to: ${outputFile}`);
    console.log(`📏 File size: ${(fs.statSync(outputFile).size / 1024 / 1024).toFixed(2)} MB`);
}

generateCSV().then(
    () => console.log('1M products CSV generated successfully!'),
    err => console.error('Failed to generate CSV:', err),
);
