#!/usr/bin/env node

/**
 * Auto Database Migration Script
 * 
 * This script:
 * 1. Checks if all required tables and columns exist
 * 2. Creates missing tables
 * 3. Adds missing columns
 * 4. Runs safely on both local and production
 * 5. Can be run multiple times (idempotent)
 * 
 * Usage:
 *   NODE_ENV=production node scripts/auto_migrate.js
 *   or
 *   npm run migrate:production
 */

const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

// Load environment variables
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local';
const envPath = path.resolve(process.cwd(), envFile);

if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'workwala',
  multipleStatements: true,
};

// Color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function header(title) {
  console.log('\n' + '═'.repeat(70));
  log(title, 'bright');
  console.log('═'.repeat(70) + '\n');
}

// Define expected database schema
const EXPECTED_SCHEMA = {
  // Withdrawal requests table
  withdrawal_requests: {
    columns: {
      id: 'INT AUTO_INCREMENT PRIMARY KEY',
      partner_id: 'INT NOT NULL',
      amount: 'DECIMAL(10,2) NOT NULL',
      gross_amount: 'DECIMAL(10,2) DEFAULT 0',
      platform_fee: 'DECIMAL(10,2) DEFAULT 0',
      task_fee: 'DECIMAL(10,2) DEFAULT 0',
      total_fee: 'DECIMAL(10,2) DEFAULT 0',
      net_payout: 'DECIMAL(10,2) DEFAULT 0',
      status: "ENUM('pending','approved','rejected','completed') DEFAULT 'pending'",
      request_date: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
      processed_date: 'TIMESTAMP NULL',
      processed_by: 'INT NULL',
      admin_notes: 'TEXT NULL',
      partner_notes: 'TEXT NULL',
      bank_details: 'JSON NULL',
      transaction_id: 'VARCHAR(255) NULL',
      created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
      updated_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      deleted_at: 'TIMESTAMP NULL',
    },
    indexes: [
      'INDEX idx_partner_id (partner_id)',
      'INDEX idx_status (status)',
      'INDEX idx_request_date (request_date)',
      'INDEX idx_deleted_at (deleted_at)',
      'INDEX idx_withdrawal_fees (status, total_fee, processed_date)',
    ],
    foreignKeys: [
      'FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE',
    ],
  },

  // Wallet transactions table
  wallet_transactions: {
    columns: {
      id: 'INT AUTO_INCREMENT PRIMARY KEY',
      partner_id: 'INT NOT NULL',
      type: "ENUM('earning','withdrawal','topup','fee','refund','adjustment') NOT NULL",
      amount: 'DECIMAL(10,2) NOT NULL',
      description: 'TEXT NULL',
      payment_method: "ENUM('CASH','ONLINE') NULL",
      balance_after: 'DECIMAL(10,2) NOT NULL',
      metadata: 'JSON NULL',
      created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
      updated_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
    },
    indexes: [
      'INDEX idx_partner_id (partner_id)',
      'INDEX idx_type (type)',
      'INDEX idx_created_at (created_at)',
    ],
    foreignKeys: [
      'FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE',
    ],
  },

  // Wallet topups table
  wallet_topups: {
    columns: {
      id: 'INT AUTO_INCREMENT PRIMARY KEY',
      partner_id: 'INT NOT NULL',
      amount: 'DECIMAL(10,2) NOT NULL',
      razorpay_order_id: 'VARCHAR(100) NULL',
      razorpay_payment_id: 'VARCHAR(100) NULL',
      razorpay_signature: 'VARCHAR(500) NULL',
      status: "ENUM('pending','completed','failed') DEFAULT 'pending'",
      failure_reason: 'VARCHAR(500) NULL',
      created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
      completed_at: 'TIMESTAMP NULL',
    },
    indexes: [
      'UNIQUE KEY razorpay_order_id (razorpay_order_id)',
      'INDEX idx_partner_id (partner_id)',
      'INDEX idx_status (status)',
      'INDEX idx_razorpay_order_id (razorpay_order_id)',
    ],
    foreignKeys: [
      'FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE',
    ],
  },

  // Bookings table - ensure fees_deducted column exists
  bookings: {
    columns: {
      fees_deducted: 'TINYINT(1) DEFAULT 0',
    },
  },

  // Partners table - ensure balance column exists
  partners: {
    columns: {
      balance: 'DECIMAL(10,2) DEFAULT 0.00',
    },
  },

  // Settings table - ensure wallet-related settings exist
  settings: {
    requiredSettings: [
      { key: 'partner_minimum_wallet_balance', value: '200' },
      { key: 'partner_minimum_withdrawal_amount', value: '100' },
      { key: 'partner_platform_fee_type', value: 'percentage' },
      { key: 'partner_platform_fee_value', value: '10' },
      { key: 'partner_task_fee', value: '20' },
    ],
  },
};

async function checkTableExists(connection, tableName) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) as count FROM information_schema.tables 
     WHERE table_schema = ? AND table_name = ?`,
    [DB_CONFIG.database, tableName]
  );
  return rows[0].count > 0;
}

async function checkColumnExists(connection, tableName, columnName) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) as count FROM information_schema.columns 
     WHERE table_schema = ? AND table_name = ? AND column_name = ?`,
    [DB_CONFIG.database, tableName, columnName]
  );
  return rows[0].count > 0;
}

async function createTable(connection, tableName, schema) {
  log(`Creating table: ${tableName}`, 'yellow');
  
  const columns = Object.entries(schema.columns)
    .map(([name, definition]) => `  ${name} ${definition}`)
    .join(',\n');
  
  const indexes = schema.indexes ? ',\n' + schema.indexes.map(idx => `  ${idx}`).join(',\n') : '';
  const foreignKeys = schema.foreignKeys ? ',\n' + schema.foreignKeys.map(fk => `  ${fk}`).join(',\n') : '';
  
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS ${tableName} (
${columns}${indexes}${foreignKeys}
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  
  await connection.query(createTableSQL);
  log(`✅ Table ${tableName} created successfully`, 'green');
}

async function addColumn(connection, tableName, columnName, definition) {
  log(`Adding column: ${tableName}.${columnName}`, 'yellow');
  
  try {
    await connection.query(
      `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`
    );
    log(`✅ Column ${tableName}.${columnName} added successfully`, 'green');
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      log(`⚠️  Column ${tableName}.${columnName} already exists`, 'yellow');
    } else {
      throw error;
    }
  }
}

async function ensureSettings(connection, requiredSettings) {
  log('Checking required settings...', 'cyan');
  
  for (const setting of requiredSettings) {
    const [rows] = await connection.query(
      'SELECT COUNT(*) as count FROM settings WHERE key_name = ?',
      [setting.key]
    );
    
    if (rows[0].count === 0) {
      log(`Adding setting: ${setting.key} = ${setting.value}`, 'yellow');
      await connection.query(
        'INSERT INTO settings (key_name, value, group_name) VALUES (?, ?, ?)',
        [setting.key, setting.value, 'wallet']
      );
      log(`✅ Setting ${setting.key} added`, 'green');
    } else {
      log(`✓ Setting ${setting.key} exists`, 'cyan');
    }
  }
}

async function cleanInvalidMetadata(connection) {
  log('Checking for invalid wallet transaction metadata...', 'cyan');
  
  const [invalidRows] = await connection.query(`
    SELECT COUNT(*) as count 
    FROM wallet_transactions 
    WHERE metadata IS NOT NULL 
      AND (metadata = '[object Object]' OR metadata NOT LIKE '{%')
  `);
  
  if (invalidRows[0].count > 0) {
    log(`Found ${invalidRows[0].count} invalid metadata entries, cleaning...`, 'yellow');
    await connection.query(`
      UPDATE wallet_transactions 
      SET metadata = NULL 
      WHERE metadata = '[object Object]' OR metadata NOT LIKE '{%'
    `);
    log(`✅ Cleaned ${invalidRows[0].count} invalid metadata entries`, 'green');
  } else {
    log('✓ No invalid metadata found', 'cyan');
  }
}

async function runMigration() {
  let connection;
  
  try {
    header('🚀 DATABASE AUTO-MIGRATION');
    log(`Environment: ${process.env.NODE_ENV || 'development'}`, 'cyan');
    log(`Database: ${DB_CONFIG.database}`, 'cyan');
    log(`Host: ${DB_CONFIG.host}`, 'cyan');
    
    // Connect to database
    log('\n🔌 Connecting to database...', 'cyan');
    connection = await mysql.createConnection(DB_CONFIG);
    log('✅ Connected successfully\n', 'green');
    
    // Check and create/update each table
    for (const [tableName, schema] of Object.entries(EXPECTED_SCHEMA)) {
      header(`📋 Checking table: ${tableName}`);
      
      const tableExists = await checkTableExists(connection, tableName);
      
      if (!tableExists && schema.columns) {
        // Table doesn't exist, create it
        await createTable(connection, tableName, schema);
      } else if (tableExists && schema.columns) {
        // Table exists, check columns
        log(`✓ Table ${tableName} exists, checking columns...`, 'cyan');
        
        for (const [columnName, definition] of Object.entries(schema.columns)) {
          const columnExists = await checkColumnExists(connection, tableName, columnName);
          
          if (!columnExists) {
            await addColumn(connection, tableName, columnName, definition);
          } else {
            log(`✓ Column ${tableName}.${columnName} exists`, 'cyan');
          }
        }
      }
      
      // Handle required settings
      if (schema.requiredSettings) {
        await ensureSettings(connection, schema.requiredSettings);
      }
    }
    
    // Clean invalid metadata
    header('🧹 DATA CLEANUP');
    await cleanInvalidMetadata(connection);
    
    // Final summary
    header('✅ MIGRATION COMPLETED SUCCESSFULLY');
    log('All tables and columns are up to date!', 'green');
    log('Database is ready for use.', 'green');
    
  } catch (error) {
    header('❌ MIGRATION FAILED');
    log(error.message, 'red');
    log('\nStack trace:', 'red');
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      log('\n🔌 Database connection closed', 'cyan');
    }
  }
}

// Run migration
if (require.main === module) {
  runMigration().catch(console.error);
}

module.exports = { runMigration };
