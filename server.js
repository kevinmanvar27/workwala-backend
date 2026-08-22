/**
 * Custom Server with Auto-Migration
 * 
 * This file runs migrations automatically when the server starts.
 * Perfect for Hostinger auto-deploy - no manual commands needed!
 */

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

// Load environment variables
const envFile = dev ? '.env.local' : '.env.production';
require('dotenv').config({ path: path.resolve(process.cwd(), envFile) });

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Database configuration
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
};
const DB_NAME = process.env.DB_NAME || 'linko';

/**
 * Ensure required directories exist
 */
function ensureDirectories() {
  const directories = [
    'public/uploads/customers',
    'public/uploads/partners',
    'public/uploads/documents',
    'public/uploads/categories',
  ];

  console.log('📁 Checking required directories...');
  
  directories.forEach((dir) => {
    const fullPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      console.log(`✅ Created: ${dir}`);
    }
  });
  
  console.log('✅ All directories ready\n');
}

/**
 * Run all migrations
 */
async function runMigrations() {
  let connection;
  
  try {
    console.log('🔄 Running database migrations...');
    
    // Connect to MySQL
    connection = await mysql.createConnection(DB_CONFIG);
    
    // Create database if it doesn't exist
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await connection.query(`USE \`${DB_NAME}\``);
    console.log(`✅ Database "${DB_NAME}" ready`);
    
    // Create migrations tracking table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // Check which migrations have been executed
    const [executed] = await connection.query('SELECT name FROM migrations');
    const executedNames = executed.map(row => row.name);
    
    // Migration 1: Initial Schema
    if (!executedNames.includes('initial_schema')) {
      console.log('📦 Running: initial_schema');
      try {
        delete require.cache[require.resolve('./scripts/migrate')];
        require('./scripts/migrate');
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for migration to complete
        await connection.query("INSERT IGNORE INTO migrations (name) VALUES ('initial_schema')");
        console.log('✅ Completed: initial_schema');
      } catch (err) {
        console.log('⚠️  initial_schema may have already run');
      }
    } else {
      console.log('⏭️  Skipping: initial_schema (already executed)');
    }
    
    // Migration 2: Coupons Module
    if (!executedNames.includes('coupons_module')) {
      console.log('📦 Running: coupons_module');
      try {
        delete require.cache[require.resolve('./scripts/migrate_coupons')];
        require('./scripts/migrate_coupons');
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for migration to complete
        await connection.query("INSERT IGNORE INTO migrations (name) VALUES ('coupons_module')");
        console.log('✅ Completed: coupons_module');
      } catch (err) {
        console.log('⚠️  coupons_module may have already run');
      }
    } else {
      console.log('⏭️  Skipping: coupons_module (already executed)');
    }
    
    // Migration 3: Notifications Module
    if (!executedNames.includes('notifications_module')) {
      console.log('📦 Running: notifications_module');
      try {
        delete require.cache[require.resolve('./scripts/migrate_notifications')];
        require('./scripts/migrate_notifications');
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for migration to complete
        await connection.query("INSERT IGNORE INTO migrations (name) VALUES ('notifications_module')");
        console.log('✅ Completed: notifications_module');
      } catch (err) {
        console.log('⚠️  notifications_module may have already run');
      }
    } else {
      console.log('⏭️  Skipping: notifications_module (already executed)');
    }
    
    console.log('✅ All migrations completed!\n');
    
  } catch (error) {
    console.error('⚠️  Migration error:', error.message);
    console.log('⚠️  Server will start anyway...\n');
  } finally {
    if (connection) await connection.end();
  }
}

/**
 * Start the server
 */
async function startServer() {
  try {
    // Ensure directories exist
    ensureDirectories();
    
    // Run migrations first
    await runMigrations();
    
    // Prepare Next.js
    await app.prepare();
    
    // Create HTTP server
    createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error('Error handling request:', err);
        res.statusCode = 500;
        res.end('Internal server error');
      }
    }).listen(port, (err) => {
      if (err) throw err;
      console.log(`🚀 Server ready on http://${hostname}:${port}`);
      console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start everything
startServer();
