const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');

async function downloadCSVFromStorage(fileName = '1-million-products.csv') {
    console.log(`🚀 Downloading ${fileName} from Cloud Storage...`);
    
    const storage = new Storage({
        projectId: 'glass-next'
    });
    
    const bucketName = 'glass-next-vendure-data';
    const bucket = storage.bucket(bucketName);
    
    try {
        const remoteFileName = `products/${fileName}`;
        const file = bucket.file(remoteFileName);
        
        // Check if file exists
        const [exists] = await file.exists();
        if (!exists) {
            throw new Error(`File ${fileName} not found in bucket ${bucketName}`);
        }
        
        // Get file metadata
        const [metadata] = await file.getMetadata();
        const fileSizeMB = (metadata.size / 1024 / 1024).toFixed(2);
        console.log(`📊 File size: ${fileSizeMB} MB`);
        
        // Ensure local directory exists
        const localDir = path.join(__dirname, '../../static/assets/import');
        if (!fs.existsSync(localDir)) {
            fs.mkdirSync(localDir, { recursive: true });
        }
        
        const localFilePath = path.join(localDir, fileName);
        
        console.log(`📥 Downloading to ${localFilePath}...`);
        
        await file.download({
            destination: localFilePath
        });
        
        console.log(`✅ ${fileName} downloaded successfully!`);
        console.log(`📁 Local path: ${localFilePath}`);
        
        return localFilePath;
        
    } catch (error) {
        console.error('❌ Download failed:', error);
        throw error;
    }
}

if (require.main === module) {
    const fileName = process.argv[2] || '1-million-products.csv';
    downloadCSVFromStorage(fileName).then(
        () => console.log('Download completed!'),
        err => console.error('Download failed:', err)
    );
}

module.exports = { downloadCSVFromStorage };
