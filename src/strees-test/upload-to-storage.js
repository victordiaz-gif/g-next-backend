const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');

async function uploadCSVToStorage() {
    console.log('🚀 Starting CSV upload to Cloud Storage...');
    
    const storage = new Storage({
        projectId: 'glass-next'
    });
    
    const bucketName = 'glass-next-vendure-data';
    const bucket = storage.bucket(bucketName);
    
    try {
        // Ensure bucket exists
        const [exists] = await bucket.exists();
        if (!exists) {
            console.log('📦 Creating bucket...');
            await bucket.create({
                location: 'us-central1',
                storageClass: 'STANDARD'
            });
            console.log('✅ Bucket created successfully!');
        }
        
        const localDir = path.join(__dirname, '../../static/assets/import');
        const files = fs.readdirSync(localDir).filter(file => file.endsWith('.csv'));
        
        if (files.length === 0) {
            console.log('❌ No CSV files found in import directory');
            return;
        }
        
        console.log(`📁 Found ${files.length} CSV files to upload:`);
        files.forEach(file => console.log(`  - ${file}`));
        
        for (const file of files) {
            const localFilePath = path.join(localDir, file);
            const fileSize = fs.statSync(localFilePath).size;
            const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);
            
            console.log(`📤 Uploading ${file} (${fileSizeMB} MB)...`);
            
            const remoteFileName = `products/${file}`;
            
            await bucket.upload(localFilePath, {
                destination: remoteFileName,
                metadata: {
                    contentType: 'text/csv',
                    cacheControl: 'public, max-age=3600'
                }
            });
            
            console.log(`✅ ${file} uploaded successfully!`);
            console.log(`🔗 URL: gs://${bucketName}/${remoteFileName}`);
        }
        
        console.log('🎉 All files uploaded successfully!');
        
    } catch (error) {
        console.error('❌ Upload failed:', error);
        throw error;
    }
}

if (require.main === module) {
    uploadCSVToStorage().then(
        () => console.log('Upload completed!'),
        err => console.error('Upload failed:', err)
    );
}

module.exports = { uploadCSVToStorage };
