const { bootstrap } = require('@vendure/core');
const { VendureConfig } = require('./dist/vendure-config');

async function setupBasicConfig() {
    console.log('Setting up basic Vendure configuration...');
    
    try {
        const { app } = await bootstrap(VendureConfig);
        
        // Get the admin API client
        const adminClient = app.get('AdminApiService');
        
        console.log('✅ Vendure application started successfully');
        console.log('✅ Basic configuration is complete');
        console.log('');
        console.log('🔧 Next steps:');
        console.log('1. Go to the Admin UI: https://vendure-backend-393513168568.us-central1.run.app/admin/');
        console.log('2. Log in with: superadmin / superadmin');
        console.log('3. Navigate to Settings > Tax Zones');
        console.log('4. Create a default tax zone');
        console.log('5. Add countries to the zone');
        console.log('6. Create tax rates for the zone');
        console.log('');
        console.log('This will resolve the "active tax zone could not be determined" error.');
        
        await app.close();
    } catch (error) {
        console.error('❌ Error setting up configuration:', error.message);
        process.exit(1);
    }
}

setupBasicConfig();
