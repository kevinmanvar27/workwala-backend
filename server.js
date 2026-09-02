/**
 * Custom Server with Auto-Migration
 * 
 * This file runs migrations automatically when the server starts.
 * Perfect for Hostinger auto-deploy - no manual commands needed!
 */

const { createServer } = require('http');
const { parse } = require('url');
const { spawn } = require('child_process');
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
 * Run all migrations using the auto-migrate system
 */
async function runMigrations() {
  try {
    console.log('🔄 Running database migrations via auto-migrate system...\n');
    
    return new Promise((resolve) => {
      const autoMigrate = spawn('node', [path.join(__dirname, 'scripts', 'auto-migrate.js')], {
        env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'development' },
        cwd: process.cwd()
      });

      autoMigrate.stdout.on('data', (data) => {
        process.stdout.write(data.toString());
      });

      autoMigrate.stderr.on('data', (data) => {
        process.stderr.write(data.toString());
      });

      autoMigrate.on('close', (code) => {
        if (code === 0) {
          console.log('\n✅ Auto-migration completed successfully\n');
        } else {
          console.log('\n⚠️  Auto-migration had issues but continuing...\n');
        }
        resolve();
      });

      autoMigrate.on('error', (error) => {
        console.error('⚠️  Migration error:', error.message);
        console.log('⚠️  Server will start anyway...\n');
        resolve();
      });
    });
    
  } catch (error) {
    console.error('⚠️  Migration error:', error.message);
    console.log('⚠️  Server will start anyway...\n');
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
