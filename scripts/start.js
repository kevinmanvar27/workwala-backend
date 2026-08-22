#!/usr/bin/env node

/**
 * Safe Startup Script for Production
 * 
 * This script runs migrations and then starts the Next.js server.
 * If migrations fail, the server will still start (with a warning).
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting WorkWala Backend...\n');

// Step 1: Run migrations
console.log('📦 Step 1: Running database migrations...');
const migrateProcess = spawn('node', [path.join(__dirname, 'auto-migrate.js')], {
  stdio: 'inherit',
  env: process.env
});

migrateProcess.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ Migrations completed successfully\n');
  } else {
    console.warn('\n⚠️  Migrations had issues (see logs above)\n');
  }
  
  // Step 2: Start Next.js server (regardless of migration status)
  console.log('🌐 Step 2: Starting Next.js server...\n');
  const serverProcess = spawn('next', ['start'], {
    stdio: 'inherit',
    env: process.env
  });

  serverProcess.on('error', (error) => {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  });

  serverProcess.on('close', (serverCode) => {
    process.exit(serverCode);
  });

  // Handle termination signals
  process.on('SIGTERM', () => {
    console.log('\n👋 Received SIGTERM, shutting down gracefully...');
    serverProcess.kill('SIGTERM');
  });

  process.on('SIGINT', () => {
    console.log('\n👋 Received SIGINT, shutting down gracefully...');
    serverProcess.kill('SIGINT');
  });
});

migrateProcess.on('error', (error) => {
  console.error('❌ Failed to run migrations:', error.message);
  console.warn('⚠️  Starting server anyway...\n');
  
  // Start server even if migration process fails to spawn
  const serverProcess = spawn('next', ['start'], {
    stdio: 'inherit',
    env: process.env
  });

  serverProcess.on('close', (serverCode) => {
    process.exit(serverCode);
  });
});
