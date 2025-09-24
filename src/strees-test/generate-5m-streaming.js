const fs = require('fs');
const path = require('path');

async function generate5MStreaming() {
    console.log('🚀 Generating 5M products CSV file using streaming...');
    
    const inputDir = path.join(__dirname, '../../static/assets/import');
    const inputFile = path.join(inputDir, '1-million-products.csv');
    const outputFile = path.join(inputDir, '5-million-products.csv');
    
    // Check if 1M file exists
    if (!fs.existsSync(inputFile)) {
        console.error('❌ 1M products file not found. Please run generate:1m-products first.');
        process.exit(1);
    }
    
    // Create read stream for input file
    const readStream = fs.createReadStream(inputFile, { encoding: 'utf8' });
    const writeStream = fs.createWriteStream(outputFile);
    
    let isFirstLine = true;
    let lineCount = 0;
    let batchCount = 0;
    
    console.log('📁 Reading 1M products file and creating 5M products...');
    
    readStream.on('data', (chunk) => {
        const lines = chunk.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            if (isFirstLine) {
                // Write header only once
                writeStream.write(line + '\n');
                isFirstLine = false;
            } else if (line.trim()) {
                // Write data line 5 times
                for (let j = 0; j < 5; j++) {
                    writeStream.write(line + '\n');
                }
                lineCount++;
                
                if (lineCount % 100000 === 0) {
                    console.log(`📈 Processed ${lineCount} lines...`);
                }
            }
        }
    });
    
    readStream.on('end', () => {
        writeStream.end();
        console.log('✅ 5M products CSV generation completed!');
        console.log(`📊 Processed ${lineCount} data lines`);
        console.log(`📁 File saved to: ${outputFile}`);
        
        // Get file size
        const stats = fs.statSync(outputFile);
        console.log(`📏 File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    });
    
    readStream.on('error', (err) => {
        console.error('❌ Error reading input file:', err);
        process.exit(1);
    });
    
    writeStream.on('error', (err) => {
        console.error('❌ Error writing output file:', err);
        process.exit(1);
    });
}

generate5MStreaming().then(
    () => console.log('5M products CSV generated successfully!'),
    err => console.error('Failed to generate CSV:', err),
);
