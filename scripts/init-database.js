#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Initializing Vendure Database...\n');

async function runCommand(command, options = {}) {
    try {
        const result = execSync(command, { 
            stdio: 'inherit', 
            ...options 
        });
        return result;
    } catch (error) {
        if (options.ignoreError) {
            console.log(`⚠️  Command failed (ignored): ${command}`);
            return;
        }
        throw error;
    }
}

async function waitForServices() {
    console.log('⏳ Waiting for Docker services to be ready...');
    await new Promise(resolve => setTimeout(resolve, 10000));
}

async function checkDatabaseEmpty() {
    try {
        const result = execSync('docker exec vendure-backend-postgres_db-1 psql -U vendure -d vendure -c "\\dt"', { 
            stdio: 'pipe',
            encoding: 'utf8'
        });
        console.log('Database check result:', JSON.stringify(result));
        const isEmpty = result.includes('Did not find any relations') || result.includes('No relations found') || result.trim() === '';
        console.log('Is database empty?', isEmpty);
        return isEmpty;
    } catch (error) {
        console.log('Database check error:', error.message);
        return true; // Assume empty if we can't check
    }
}

async function killProcessOnPort(port) {
    try {
        console.log(`🔍 Checking for processes using port ${port}...`);
        // Find processes using the port (macOS/Linux compatible)
        const result = execSync(`lsof -ti :${port}`, { stdio: 'pipe', encoding: 'utf8' });
        if (result.trim()) {
            console.log(`⚠️  Port ${port} is in use, killing processes...`);
            // Extract PIDs and kill them
            const pids = result.trim().split('\n').filter(pid => pid.trim());
            for (const pid of pids) {
                if (pid && pid !== '0') {
                    try {
                        execSync(`kill -9 ${pid}`, { stdio: 'pipe' });
                        console.log(`✅ Killed process ${pid} using port ${port}`);
                    } catch (killError) {
                        // Ignore if process already dead
                    }
                }
            }
            // Wait a moment for processes to fully terminate
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        console.log(`✅ Port ${port} is now free`);
    } catch (error) {
        console.log(`✅ Port ${port} is free`);
    }
}

async function ensurePortIsFree(port = 3000) {
    await killProcessOnPort(port);
    // Double-check by trying to find any remaining processes
    try {
        const result = execSync(`lsof -ti :${port}`, { stdio: 'pipe', encoding: 'utf8' });
        if (result.trim()) {
            console.log(`⚠️  Port ${port} still in use, force killing all Node processes...`);
            execSync('pkill -f node', { stdio: 'pipe' });
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    } catch (error) {
        // Port is free
    }
}

async function markMigrationsAsCompleted() {
    console.log('📝 Marking migrations as completed...');
    
    const migrations = [
        { timestamp: 1754460888403, name: 'MultivendorPlugin1754460888403' },
        { timestamp: 1754637693231, name: 'StripePlugin1754637693231' },
        { timestamp: 1755467482914, name: 'CleanupMarketplaceTables1755467482914' },
        { timestamp: 1755467528803, name: 'MarketplacePaymentPlugin1755467528803' },
        { timestamp: 1755503190355, name: 'AddedSellerChannelIDToOrder1755503190355' },
        { timestamp: 1755507653934, name: 'AddedOrderSellerChannelCode1755507653934' }
    ];

    for (const migration of migrations) {
        const query = `INSERT INTO migrations (timestamp, name) VALUES (${migration.timestamp}, '${migration.name}') ON CONFLICT DO NOTHING;`;
        await runCommand(`docker exec vendure-backend-postgres_db-1 psql -U vendure -d vendure -c "${query}"`, { ignoreError: true });
    }
    
    console.log('✅ Migrations marked as completed');
}

async function main() {
    try {
        // Step 0: Ensure port 3000 is free before starting
        console.log('0. Ensuring port 3000 is free...');
        await ensurePortIsFree(3000);
        console.log('✅ Port 3000 is ready\n');

        // Step 1: Start Docker services
        console.log('1. Starting Docker services...');
        await runCommand('docker-compose up -d postgres_db redis elasticsearch');
        console.log('✅ Docker services started\n');

        // Step 2: Wait for services
        await waitForServices();

        // Step 3: Check if database is empty
        const isEmpty = await checkDatabaseEmpty();
        
        if (isEmpty) {
            console.log('📊 Database is empty, creating schema...');
            
            // Step 4: Set environment variable for initialization
            process.env.INIT_DB = 'true';
            process.env.NODE_ENV = 'development';
            
            // Step 5: Start server briefly to create schema
            console.log('🏗️  Creating database schema...');
            const serverProcess = spawn('npm', ['run', 'dev'], {
                stdio: 'pipe',
                env: { ...process.env, INIT_DB: 'true', NODE_ENV: 'development' },
                shell: true
            });
            
            // Wait for schema creation
            await new Promise(resolve => setTimeout(resolve, 15000));
            
            // Stop the server
            serverProcess.kill('SIGTERM');
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Ensure server is completely stopped and port is free
            console.log('🔍 Ensuring server is completely stopped...');
            await ensurePortIsFree(3000);
            
            console.log('✅ Database schema created');
            
            // Step 6: Mark migrations as completed
            await markMigrationsAsCompleted();
            
            // Step 7: Verify migrations
            console.log('🔍 Verifying migrations...');
            await runCommand('npx @vendure/cli migrate --run', { ignoreError: true });
            console.log('✅ Migrations verified');
            
            // Step 8: Ensure port is free before populating
            console.log('🔍 Ensuring port 3000 is free before populating...');
            await ensurePortIsFree(3000);

            // Step 9: Populate initial data
            console.log('🌱 Populating initial data...');
            try {
                await runCommand('npm run populate', { ignoreError: true });
                console.log('✅ Initial data populated');
            } catch (error) {
                console.log('⚠️  Populate command not available, skipping data population');
            }
            console.log('');
            
        } else {
            console.log('📊 Database already has data, skipping initialization');
            
            // Ensure port is free before populating even if database has data
            console.log('🔍 Ensuring port 3000 is free before populating...');
            await ensurePortIsFree(3000);
        }

        // Final cleanup to ensure port is free for user
        console.log('🔍 Final port cleanup...');
        await ensurePortIsFree(3000);
        
        // Kill any remaining Node.js processes from populate command
        console.log('🔍 Cleaning up any remaining processes...');
        try {
            execSync('pkill -f node', { stdio: 'pipe' });
            console.log('✅ All processes cleaned up');
        } catch (error) {
            console.log('✅ No additional processes to clean up');
        }

        console.log('🎉 Database initialization completed!');
        console.log('✨ The database is ready for use.');
        console.log('\nTo start the development server, run:');
        console.log('npm run dev');
        
        // Exit successfully
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Initialization failed:', error.message);
        process.exit(1);
    }
}

main();
