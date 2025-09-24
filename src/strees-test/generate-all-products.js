const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function generateAllProducts() {
    console.log('🚀 Starting complete product generation process...');
    console.log('📋 This will generate 1M products first, then 5M products');
    
    try {
        // Step 1: Generate 1 million products
        console.log('\n📦 Step 1: Generating 1 million products...');
        console.log('⏳ Running: npm run generate:1m-products');
        
        execSync('npm run generate:1m-products', { 
            stdio: 'inherit',
            cwd: process.cwd()
        });
        
        console.log('✅ 1 million products generated successfully!');
        
        // Verify 1M file exists
        const oneMFile = path.join(__dirname, 'static/assets/import/1-million-products.csv');
        if (fs.existsSync(oneMFile)) {
            const stats = fs.statSync(oneMFile);
            console.log(`📁 1M file size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        } else {
            throw new Error('1M products file was not created');
        }
        
        // Step 2: Generate 5 million products
        console.log('\n📦 Step 2: Generating 5 million products...');
        console.log('⏳ Running: npm run generate:5m-products');
        
        execSync('npm run generate:5m-products', { 
            stdio: 'inherit',
            cwd: process.cwd()
        });
        
        console.log('✅ 5 million products generated successfully!');
        
        // Verify 5M file exists
        const fiveMFile = path.join(__dirname, 'static/assets/import/5-million-products.csv');
        if (fs.existsSync(fiveMFile)) {
            const stats = fs.statSync(fiveMFile);
            console.log(`📁 5M file size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        } else {
            throw new Error('5M products file was not created');
        }
        
        console.log('\n🎉 Complete product generation process finished successfully!');
        console.log('📊 Summary:');
        console.log('   - 1 million products: ✅ Generated');
        console.log('   - 5 million products: ✅ Generated');
        console.log('   - Ready for stress testing! 🚀');
        
    } catch (error) {
        console.error('❌ Error during product generation:', error.message);
        process.exit(1);
    }
}

generateAllProducts();
