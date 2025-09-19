const { spawn } = require('child_process');
const path = require('path');

// Set environment variables for Cloud SQL
process.env.NODE_ENV = 'production';
process.env.APP_ENV = 'production';
process.env.DB_TYPE = 'postgres';
process.env.DB_HOST = '34.171.38.108';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'vendure';
process.env.DB_USERNAME = 'vendure';
process.env.DB_PASSWORD = 'YAXNqZB2DBu8NENFJTIBA';
process.env.DB_SCHEMA = 'public';
process.env.SUPERADMIN_USERNAME = 'superadmin';
process.env.SUPERADMIN_PASSWORD = 'superadmin';
process.env.COOKIE_SECRET = 'your-cookie-secret-here-change-this-in-production';

console.log('Running database migrations...');
console.log('Database Host:', process.env.DB_HOST);
console.log('Database Name:', process.env.DB_NAME);

// Run the migration command
const migrationProcess = spawn('npx', ['vendure', 'migrate'], {
  stdio: 'inherit',
  shell: true,
  cwd: __dirname
});

migrationProcess.on('close', (code) => {
  if (code === 0) {
    console.log('✅ Migrations completed successfully!');
  } else {
    console.error('❌ Migration failed with code:', code);
    process.exit(code);
  }
});

migrationProcess.on('error', (error) => {
  console.error('❌ Failed to start migration process:', error);
  process.exit(1);
});
