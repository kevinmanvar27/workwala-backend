/**
 * Auto Migration Script for Hostinger Deployment
 * 
 * This script automatically runs all pending database migrations on deployment.
 * It tracks which migrations have been executed and only runs new ones.
 * 
 * Usage:
 * - Runs automatically on deployment via package.json "start" script
 * - Can be run manually: node scripts/auto-migrate.js
 */

const mysql = require('mysql2/promise');
const path = require('path');
const { spawn } = require('child_process');

// Load the correct env file based on NODE_ENV
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local';
require('dotenv').config({ path: path.resolve(process.cwd(), envFile) });

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
};

const DB_NAME = process.env.DB_NAME || 'linko';

// Define all migration files in execution order
const MIGRATIONS = [
  {
    name: 'initial_schema',
    file: 'migrate.js',
    description: 'Initial database schema with all core tables'
  },
  {
    name: 'coupons_module',
    file: 'migrate_coupons.js',
    description: 'Coupon management system tables'
  },
  {
    name: 'notifications_module',
    file: 'migrate_notifications.js',
    description: 'Push notification management tables'
  },
  {
    name: 'link_services_categories',
    file: 'migrate_link_services_categories.js',
    description: 'Link services to categories for icon display'
  },
  {
    name: 'missing_tables_live',
    file: 'migrate_missing_tables.js',
    description: 'Create languages, translations, withdrawal_requests and FCM token tables missing on live server'
  },
  {
    name: 'seed_pages',
    file: 'migrate_seed_pages.js',
    description: 'Seed all 5 default pages (Help & Support, About, About Us, Privacy Policy, Terms of Service)'
  }
];

/**
 * Create migrations tracking table if it doesn't exist
 */
async function ensureMigrationsTable(connection) {
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        execution_time_ms INT,
        status ENUM('success', 'failed') DEFAULT 'success',
        error_message TEXT NULL,
        INDEX idx_name (name),
        INDEX idx_executed_at (executed_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Migrations tracking table ready');
  } catch (error) {
    console.error('❌ Failed to create migrations table:', error.message);
    throw error;
  }
}

/**
 * Check if a migration has already been executed
 */
async function isMigrationExecuted(connection, migrationName) {
  try {
    const [rows] = await connection.query(
      'SELECT id FROM migrations WHERE name = ? AND status = "success"',
      [migrationName]
    );
    return rows.length > 0;
  } catch (error) {
    console.error(`❌ Error checking migration status: ${error.message}`);
    return false;
  }
}

/**
 * Record a migration execution
 */
async function recordMigration(connection, name, description, executionTime, status = 'success', error = null) {
  try {
    await connection.query(
      `INSERT INTO migrations (name, description, execution_time_ms, status, error_message) 
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
         executed_at = CURRENT_TIMESTAMP,
         execution_time_ms = VALUES(execution_time_ms),
         status = VALUES(status),
         error_message = VALUES(error_message)`,
      [name, description, executionTime, status, error]
    );
  } catch (err) {
    console.error(`❌ Failed to record migration: ${err.message}`);
  }
}

/**
 * Execute a single migration file as a separate process
 */
async function executeMigration(connection, migration) {
  const migrationPath = path.join(__dirname, migration.file);
  
  console.log(`\n📦 Running migration: ${migration.name}`);
  console.log(`   Description: ${migration.description}`);
  
  const startTime = Date.now();
  
  return new Promise((resolve) => {
    const child = spawn('node', [migrationPath], {
      env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'development' },
      cwd: process.cwd()
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      process.stdout.write(output);
    });

    child.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      process.stderr.write(output);
    });

    child.on('close', async (code) => {
      const executionTime = Date.now() - startTime;
      
      if (code === 0) {
        await recordMigration(connection, migration.name, migration.description, executionTime, 'success');
        console.log(`✅ Migration completed in ${executionTime}ms: ${migration.name}`);
        resolve(true);
      } else {
        const errorMsg = stderr || `Process exited with code ${code}`;
        await recordMigration(connection, migration.name, migration.description, executionTime, 'failed', errorMsg);
        console.error(`❌ Migration failed: ${migration.name}`);
        console.error(`   Error: ${errorMsg}`);
        resolve(false);
      }
    });

    child.on('error', async (error) => {
      const executionTime = Date.now() - startTime;
      await recordMigration(connection, migration.name, migration.description, executionTime, 'failed', error.message);
      console.error(`❌ Migration error: ${migration.name}`);
      console.error(`   Error: ${error.message}`);
      resolve(false);
    });
  });
}

/**
 * Main auto-migration function
 */
async function autoMigrate() {
  let connection;
  
  try {
    console.log('🚀 Starting Auto-Migration System');
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📍 Database: ${DB_NAME}`);
    console.log('─'.repeat(60));
    
    // Connect to MySQL
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ Connected to MySQL server');
    
    // Create database if it doesn't exist
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await connection.query(`USE \`${DB_NAME}\``);
    console.log(`✅ Database "${DB_NAME}" ready`);
    
    // Ensure migrations tracking table exists
    await ensureMigrationsTable(connection);
    
    // Check and run pending migrations
    let pendingCount = 0;
    let successCount = 0;
    let failedCount = 0;
    
    for (const migration of MIGRATIONS) {
      const isExecuted = await isMigrationExecuted(connection, migration.name);
      
      if (isExecuted) {
        console.log(`⏭️  Skipping (already executed): ${migration.name}`);
        continue;
      }
      
      pendingCount++;
      const success = await executeMigration(connection, migration);
      
      if (success) {
        successCount++;
      } else {
        failedCount++;
        // Continue with other migrations even if one fails
        console.warn(`⚠️  Continuing with remaining migrations...`);
      }
    }
    
    // Summary
    console.log('\n' + '═'.repeat(60));
    console.log('📊 Migration Summary:');
    console.log(`   Total migrations: ${MIGRATIONS.length}`);
    console.log(`   Already executed: ${MIGRATIONS.length - pendingCount}`);
    console.log(`   Pending: ${pendingCount}`);
    console.log(`   ✅ Successful: ${successCount}`);
    if (failedCount > 0) {
      console.log(`   ❌ Failed: ${failedCount}`);
    }
    console.log('═'.repeat(60));
    
    if (pendingCount === 0) {
      console.log('\n✨ All migrations are up to date!');
    } else if (successCount > 0) {
      console.log('\n🎉 Migrations completed!');
    }
    
    // Don't exit with error code - let the server start anyway
    if (failedCount > 0) {
      console.warn('\n⚠️  Some migrations failed, but server will start anyway.');
      console.warn('   Please check the logs and fix migrations manually if needed.');
    }
    
  } catch (error) {
    console.error('\n❌ Auto-migration system error:');
    console.error(error.message);
    console.warn('\n⚠️  Migration failed, but server will start anyway.');
    console.warn('   Please run migrations manually: npm run migrate:auto');
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n👋 Database connection closed');
    }
  }
}

// Run auto-migration
autoMigrate().then(() => {
  console.log('\n✅ Auto-migration process completed');
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Fatal error in auto-migration:', error.message);
  // Exit with 0 anyway to allow server to start
  process.exit(0);
});
