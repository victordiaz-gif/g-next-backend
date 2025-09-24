const fs = require('fs');
const path = require('path');

async function generate5MFrom1M() {
    console.log('🚀 Generating 5M products CSV file from 1M template...');
    
    const inputDir = path.join(__dirname, '../../static/assets/import');
    const inputFile = path.join(inputDir, '1-million-products.csv');
    const outputFile = path.join(inputDir, '5-million-products.csv');
    
    // Check if 1M file exists
    if (!fs.existsSync(inputFile)) {
        console.error('❌ 1M products file not found. Please run generate-1m-products.js first.');
        process.exit(1);
    }
    
    // Read the 1M products file
    console.log('📁 Reading 1M products file...');
    const content = fs.readFileSync(inputFile, 'utf-8');
    const lines = content.split('\n');
    const header = lines[0];
    const dataLines = lines.slice(1).filter(line => line.trim());
    
    console.log(`📊 Found ${dataLines.length} data lines in 1M file`);
    
    // Create write stream for 5M file
    const writeStream = fs.createWriteStream(outputFile);
    
    // Write header
    writeStream.write(header + '\n');
    
    // Copy the 1M data 5 times
    for (let i = 0; i < 5; i++) {
        console.log(`📦 Copying batch ${i + 1}/5...`);
        
        for (const line of dataLines) {
            writeStream.write(line + '\n');
        }
    }
    
    writeStream.end();
    
    // Wait for the stream to finish writing
    await new Promise((resolve, reject) => {
        writeStream.on('finish', () => resolve());
        writeStream.on('error', reject);
    });
    
    console.log('✅ 5M products CSV generation completed!');
    console.log(`📁 File saved to: ${outputFile}`);
    console.log(`📏 File size: ${(fs.statSync(outputFile).size / 1024 / 1024).toFixed(2)} MB`);
}

generate5MFrom1M().then(
    () => console.log('5M products CSV generated successfully!'),
    err => console.error('Failed to generate CSV:', err),
);
