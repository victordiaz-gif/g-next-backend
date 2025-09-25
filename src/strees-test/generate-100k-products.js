const fs = require('fs');
const path = require('path');

async function generate100KProducts() {
    console.log('🚀 Generating 100K products CSV file...');

    const outputDir = path.join(__dirname, '../../static/assets/import');
    const outputFile = path.join(outputDir, '100k-products.csv');

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const writeStream = fs.createWriteStream(outputFile);

    const headers = [
        'name', 'slug', 'description', 'assets', 'facets', 'optionGroups',
        'optionValues', 'sku', 'price', 'taxCategory', 'stockOnHand',
        'trackInventory', 'variantAssets', 'variantFacets'
    ];
    writeStream.write(headers.join(',') + '\n');

    const totalProducts = 100000;
    const variantsPerProduct = 3;
    const batchSize = 10000; // Process in batches

    console.log(`📊 Generating ${totalProducts} products with ${variantsPerProduct} variants each...`);

    let productCount = 0;
    let variantCount = 0;

    const categories = ['Electronics', 'Clothing', 'Home & Garden', 'Sports', 'Books'];
    const brands = ['BrandA', 'BrandB', 'BrandC', 'BrandD', 'BrandE'];
    const colors = ['Red', 'Blue', 'Green'];
    const sizes = ['XS', 'S', 'M'];

    for (let i = 0; i < totalProducts; i += batchSize) {
        const batch = [];
        const currentBatchSize = Math.min(batchSize, totalProducts - i);

        for (let j = 0; j < currentBatchSize; j++) {
            const productIndex = i + j;
            const category = categories[productIndex % categories.length];
            const brand = brands[productIndex % brands.length];

            const productName = `${category} Product ${productIndex + 1}`;
            const productSlug = `product-${productIndex + 1}`;
            const productDescription = `Description for ${productName}`;

            // Product row (first variant)
            batch.push([
                `"${productName}"`,
                `"${productSlug}"`,
                `"${productDescription}"`,
                `"product-${productIndex + 1}-main.jpg"`,
                `"category:${category}|brand:${brand}"`,
                `"Color|Size"`,
                `""`, // optionValues for product row
                `""`, // sku for product row
                `""`, // price for product row
                `""`, // taxCategory for product row
                `""`, // stockOnHand for product row
                `""`, // trackInventory for product row
                `""`, // variantAssets for product row
                `""`  // variantFacets for product row
            ].join(','));

            for (let v = 0; v < variantsPerProduct; v++) {
                const color = colors[v % colors.length];
                const size = sizes[v % sizes.length];
                const sku = `SKU-${productIndex + 1}-${color}-${size}`;
                const price = (10 + Math.random() * 100).toFixed(2);
                const stock = Math.floor(Math.random() * 1000) + 100;

                // Variant rows
                batch.push([
                    `""`, // name
                    `""`, // slug
                    `""`, // description
                    `""`, // assets
                    `""`, // facets
                    `""`, // optionGroups
                    `"${color}|${size}"`,
                    `"${sku}"`,
                    `"${price}"`,
                    `"standard"`,
                    `"${stock}"`,
                    `"true"`,
                    `"variant-${productIndex + 1}-${v + 1}.jpg"`,
                    `"color:${color}|size:${size}"`
                ].join(','));
                variantCount++;
            }
            productCount++;
        }
        writeStream.write(batch.join('\n') + '\n');

        if (productCount % 10000 === 0) {
            console.log(`📈 Generated ${productCount} products (${variantCount} variants)...`);
        }
    }

    writeStream.end();

    await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
    });

    console.log('✅ CSV generation completed!');
    console.log(`📊 Total products: ${productCount}`);
    console.log(`📊 Total variants: ${variantCount}`);
    console.log(`📁 File saved to: ${outputFile}`);
    console.log(`📏 File size: ${(fs.statSync(outputFile).size / 1024 / 1024).toFixed(2)} MB`);
}

if (require.main === module) {
    generate100KProducts().then(
        () => console.log('100K products CSV generated successfully!'),
        err => console.error('Failed to generate 100K products CSV:', err),
    );
}

module.exports = { generate100KProducts };
