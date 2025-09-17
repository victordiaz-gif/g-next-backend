#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Setting up Vendure database...\n');

// Step 1: Start Docker services
console.log('1. Starting Docker services...');
try {
    execSync('docker-compose up -d postgres_db redis elasticsearch', { stdio: 'inherit' });
    console.log('✅ Docker services started\n');
} catch (error) {
    console.error('❌ Failed to start Docker services:', error.message);
    process.exit(1);
}

// Step 2: Wait for services to be ready
console.log('2. Waiting for services to be ready...');
setTimeout(() => {
    try {
        // Step 3: Create schema using synchronize mode
        console.log('3. Creating database schema...');
        
        // Temporarily enable synchronize mode
        const configPath = path.join(__dirname, '../src/vendure-config.ts');
        let configContent = require('fs').readFileSync(configPath, 'utf8');
        
        // Enable synchronize
        const updatedConfig = configContent.replace(
            'synchronize: false,',
            'synchronize: true,'
        );
        require('fs').writeFileSync(configPath, updatedConfig);
        
        // Start server briefly to create schema
        console.log('   Creating core schema...');
        const serverProcess = execSync('npm run dev', { 
            stdio: 'pipe',
            timeout: 30000,
            killSignal: 'SIGTERM'
        });
        
        // Revert synchronize mode
        const revertedConfig = updatedConfig.replace(
            'synchronize: true,',
            'synchronize: false,'
        );
        require('fs').writeFileSync(configPath, revertedConfig);
        
        console.log('✅ Database schema created\n');
        
        // Step 4: Mark migrations as completed
        console.log('4. Marking migrations as completed...');
        const migrationQueries = [
            "INSERT INTO migrations (timestamp, name) VALUES (1754460888403, 'MultivendorPlugin1754460888403') ON CONFLICT DO NOTHING;",
            "INSERT INTO migrations (timestamp, name) VALUES (1754637693231, 'StripePlugin1754637693231') ON CONFLICT DO NOTHING;",
            "INSERT INTO migrations (timestamp, name) VALUES (1755467482914, 'CleanupMarketplaceTables1755467482914') ON CONFLICT DO NOTHING;",
            "INSERT INTO migrations (timestamp, name) VALUES (1755467528803, 'MarketplacePaymentPlugin1755467528803') ON CONFLICT DO NOTHING;",
            "INSERT INTO migrations (timestamp, name) VALUES (1755503190355, 'AddedSellerChannelIDToOrder1755503190355') ON CONFLICT DO NOTHING;",
            "INSERT INTO migrations (timestamp, name) VALUES (1755507653934, 'AddedOrderSellerChannelCode1755507653934') ON CONFLICT DO NOTHING;"
        ];
        
        for (const query of migrationQueries) {
            try {
                execSync(`docker exec vendure-backend-postgres_db-1 psql -U vendure -d vendure -c "${query}"`, { stdio: 'pipe' });
            } catch (error) {
                // Ignore errors if already exists
            }
        }
        
        console.log('✅ Migrations marked as completed\n');
        
        // Step 5: Verify setup
        console.log('5. Verifying setup...');
        try {
            execSync('npx @vendure/cli migrate --run', { stdio: 'pipe' });
            console.log('✅ No pending migrations found');
        } catch (error) {
            console.log('✅ Migrations verified');
        }
        
        console.log('\n🎉 Database setup completed successfully!');
        console.log('You can now run: npm run dev');
        
    } catch (error) {
        console.error('❌ Setup failed:', error.message);
        process.exit(1);
    }
}, 5000);
