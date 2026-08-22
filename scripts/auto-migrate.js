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
const fs = require('fs');

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
  }
];

/**
 * Create migrations tracking table if it doesn't exist
 */
async function ensureMigrationsTable(connection) {
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
}

/**
 * Check if a migration has already been executed
 */
async function isMigrationExecuted(connection, migrationName) {
  const [rows] = await connection.query(
    'SELECT id FROM migrations WHERE name = ? AND status = "success"',
    [migrationName]
  );
  return rows.length > 0;
}

/**
 * Record a migration execution
 */
async function recordMigration(connection, name, description, executionTime, status = 'success', error = null) {
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
}

/**
 * Execute a single migration file
 */
async function executeMigration(connection, migration) {
  const migrationPath = path.join(__dirname, migration.file);
  
  if (!fs.existsSync(migrationPath)) {
    console.warn(`⚠️  Migration file not found: ${migration.file}`);
    return false;
  }

  console.log(`\n📦 Running migration: ${migration.name}`);
  console.log(`   Description: ${migration.description}`);
  
  const startTime = Date.now();
  
  try {
    // Temporarily override process.exit to prevent migration scripts from exiting
    const originalExit = process.exit;
    let exitCalled = false;
    let exitCode = 0;
    
    process.exit = (code = 0) => {
      exitCalled = true;
      exitCode = code;
    };

    // Execute the migration by requiring it
    delete require.cache[require.resolve(migrationPath)];
    await require(migrationPath);
    
    // Restore original process.exit
    process.exit = originalExit;
    
    // Check if migration called process.exit with error
    if (exitCalled && exitCode !== 0) {
      throw new Error(`Migration exited with code ${exitCode}`);
    }
    
    const executionTime = Date.now() - startTime;
    await recordMigration(connection, migration.name, migration.description, executionTime, 'success');
    
    console.log(`✅ Migration completed in ${executionTime}ms: ${migration.name}`);
    return true;
    
  } catch (error) {
    const executionTime = Date.now() - startTime;
    await recordMigration(connection, migration.name, migration.description, executionTime, 'failed', error.message);
    
    console.error(`❌ Migration failed: ${migration.name}`);
    console.error(`   Error: ${error.message}`);
    return false;
  }
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
    
    if (failedCount > 0) {
      console.warn('\n⚠️  Some migrations failed. Please check the logs above.');
      process.exit(1);
    } else if (pendingCount === 0) {
      console.log('\n✨ All migrations are up to date!');
    } else {
      console.log('\n🎉 All pending migrations completed successfully!');
    }
    
  } catch (error) {
    console.error('\n❌ Auto-migration system failed:');
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n👋 Database connection closed');
    }
  }
}

// Run auto-migration
autoMigrate();
