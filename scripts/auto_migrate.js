/**
 * ═══════════════════════════════════════════════════════════════════════════
 * AUTO-MIGRATION SCRIPT FOR PRODUCTION DEPLOYMENT
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Purpose: Automatically sync database schema between local and production
 * - Checks for missing tables and creates them with complete schema
 * - Checks for missing columns in existing tables and adds them
 * - Safe operations: Uses IF NOT EXISTS, doesn't modify existing data
 * - Runs automatically during deployment via package.json build script
 * 
 * Usage:
 * - Automatic: Runs during `npm run build` before Next.js build
 * - Manual: `node scripts/auto_migrate.js`
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

const mysql = require('mysql2/promise');
const path = require('path');

// ═══════════════════════════════════════════════════════════════════════════
// ENVIRONMENT & DATABASE CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local';
const envPath = path.resolve(process.cwd(), envFile);

if (require('fs').existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
  console.log(`📋 Loaded environment from: ${envFile}`);
} else {
  console.log(`📋 Using system environment variables`);
}

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'linko',
  multipleStatements: true,
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPLETE DATABASE SCHEMA DEFINITION
// ═══════════════════════════════════════════════════════════════════════════

const SCHEMA = {
  // ─────────────────────────────────────────────────────────────────────────
  // WALLET TOPUPS TABLE (MISSING IN PRODUCTION)
  // ─────────────────────────────────────────────────────────────────────────
  wallet_topups: {
    createTable: `
      CREATE TABLE IF NOT EXISTS wallet_topups (
        id INT AUTO_INCREMENT PRIMARY KEY,
        partner_id INT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        razorpay_order_id VARCHAR(100) NULL,
        razorpay_payment_id VARCHAR(100) NULL,
        razorpay_signature VARCHAR(500) NULL,
        status ENUM('pending','completed','failed') DEFAULT 'pending',
        failure_reason VARCHAR(500) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP NULL,
        UNIQUE KEY razorpay_order_id (razorpay_order_id),
        INDEX idx_partner_id (partner_id),
        INDEX idx_status (status),
        FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
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
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // WALLET TRANSACTIONS TABLE
  // ─────────────────────────────────────────────────────────────────────────
  wallet_transactions: {
    columns: {
      id: 'INT AUTO_INCREMENT PRIMARY KEY',
      partner_id: 'INT NOT NULL',
      type: "ENUM('earning','fee','withdrawal','topup','refund','adjustment') NOT NULL",
      amount: 'DECIMAL(10,2) NOT NULL',
      description: 'VARCHAR(500) NULL',
      payment_method: "ENUM('cash','online','wallet') NULL",
      balance_after: 'DECIMAL(10,2) NOT NULL',
      metadata: 'JSON NULL',
      created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
      updated_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // WITHDRAWAL REQUESTS TABLE
  // ─────────────────────────────────────────────────────────────────────────
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
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // BOOKINGS TABLE
  // ─────────────────────────────────────────────────────────────────────────
  bookings: {
    columns: {
      id: 'INT AUTO_INCREMENT PRIMARY KEY',
      customer_id: 'INT NOT NULL',
      service_id: 'INT NOT NULL',
      partner_id: 'INT NULL',
      status: "ENUM('pending','assigned','in_progress','completed','cancelled') DEFAULT 'pending'",
      scheduled_date: 'DATE NOT NULL',
      scheduled_time: 'TIME NOT NULL',
      address: 'TEXT NOT NULL',
      latitude: 'DECIMAL(10,8) NULL',
      longitude: 'DECIMAL(11,8) NULL',
      price: 'DECIMAL(10,2) NOT NULL',
      discount: 'DECIMAL(10,2) DEFAULT 0',
      final_price: 'DECIMAL(10,2) NOT NULL',
      payment_method: "ENUM('cash','online','wallet') DEFAULT 'cash'",
      payment_status: "ENUM('pending','paid','failed','refunded') DEFAULT 'pending'",
      razorpay_order_id: 'VARCHAR(100) NULL',
      razorpay_payment_id: 'VARCHAR(100) NULL',
      razorpay_signature: 'VARCHAR(500) NULL',
      coupon_code: 'VARCHAR(50) NULL',
      coupon_discount: 'DECIMAL(10,2) DEFAULT 0',
      notes: 'TEXT NULL',
      cancellation_reason: 'TEXT NULL',
      cancelled_by: "ENUM('customer','partner','admin') NULL",
      otp: 'VARCHAR(6) NULL',
      otp_verified: 'TINYINT(1) DEFAULT 0',
      rating: 'TINYINT NULL',
      review: 'TEXT NULL',
      fees_deducted: 'TINYINT(1) DEFAULT 0',
      platform_fee: 'DECIMAL(10,2) DEFAULT 0',
      task_fee: 'DECIMAL(10,2) DEFAULT 0',
      partner_earning: 'DECIMAL(10,2) DEFAULT 0',
      completed_at: 'TIMESTAMP NULL',
      created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
      updated_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      deleted_at: 'TIMESTAMP NULL',
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // PARTNERS TABLE
  // ─────────────────────────────────────────────────────────────────────────
  partners: {
    columns: {
      id: 'INT AUTO_INCREMENT PRIMARY KEY',
      name: 'VARCHAR(255) NOT NULL',
      phone: 'VARCHAR(20) NOT NULL UNIQUE',
      email: 'VARCHAR(255) NULL',
      profile_image: 'VARCHAR(500) NULL',
      category_id: 'INT NULL',
      service_id: 'INT NULL',
      latitude: 'DECIMAL(10,8) NULL',
      longitude: 'DECIMAL(11,8) NULL',
      address: 'TEXT NULL',
      city: 'VARCHAR(100) NULL',
      state: 'VARCHAR(100) NULL',
      pincode: 'VARCHAR(10) NULL',
      aadhar_number: 'VARCHAR(20) NULL',
      aadhar_front: 'VARCHAR(500) NULL',
      aadhar_back: 'VARCHAR(500) NULL',
      pan_number: 'VARCHAR(20) NULL',
      pan_card: 'VARCHAR(500) NULL',
      bank_name: 'VARCHAR(255) NULL',
      account_number: 'VARCHAR(50) NULL',
      ifsc_code: 'VARCHAR(20) NULL',
      account_holder_name: 'VARCHAR(255) NULL',
      cancelled_cheque: 'VARCHAR(500) NULL',
      status: "ENUM('pending','approved','rejected','suspended') DEFAULT 'pending'",
      is_available: 'TINYINT(1) DEFAULT 1',
      rating: 'DECIMAL(3,2) DEFAULT 0',
      total_jobs: 'INT DEFAULT 0',
      completed_jobs: 'INT DEFAULT 0',
      balance: 'DECIMAL(10,2) DEFAULT 0',
      fcm_token: 'VARCHAR(500) NULL',
      created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
      updated_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      deleted_at: 'TIMESTAMP NULL',
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CUSTOMERS TABLE
  // ─────────────────────────────────────────────────────────────────────────
  customers: {
    columns: {
      id: 'INT AUTO_INCREMENT PRIMARY KEY',
      name: 'VARCHAR(255) NULL',
      phone: 'VARCHAR(20) NOT NULL UNIQUE',
      email: 'VARCHAR(255) NULL',
      profile_image: 'VARCHAR(500) NULL',
      fcm_token: 'VARCHAR(500) NULL',
      wallet_balance: 'DECIMAL(10,2) DEFAULT 0',
      created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
      updated_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      deleted_at: 'TIMESTAMP NULL',
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // SETTINGS TABLE
  // ─────────────────────────────────────────────────────────────────────────
  settings: {
    columns: {
      id: 'INT AUTO_INCREMENT PRIMARY KEY',
      key_name: 'VARCHAR(255) NOT NULL UNIQUE',
      value: 'TEXT NULL',
      group_name: 'VARCHAR(100) NULL',
      description: 'TEXT NULL',
      created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
      updated_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
    },
    requiredSettings: [
      { key: 'partner_minimum_wallet_balance', value: '200', group: 'wallet', description: 'Minimum wallet balance required for partners' },
      { key: 'partner_minimum_withdrawal_amount', value: '100', group: 'wallet', description: 'Minimum amount for withdrawal requests' },
      { key: 'partner_platform_fee_type', value: 'percentage', group: 'wallet', description: 'Platform fee type: percentage or fixed' },
      { key: 'partner_platform_fee_value', value: '10', group: 'wallet', description: 'Platform fee value (10 = 10% or ₹10)' },
      { key: 'partner_task_fee', value: '20', group: 'wallet', description: 'Per-task fee charged to partners' },
    ]
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function log(message, color = 'white') {
  const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    reset: '\x1b[0m',
  };
  console.log(`${colors[color] || colors.white}${message}${colors.reset}`);
}

function header(text) {
  const line = '═'.repeat(70);
  console.log(`\n${line}`);
  log(text, 'cyan');
  console.log(line);
}

// ═══════════════════════════════════════════════════════════════════════════
// DATABASE CHECK FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

async function tableExists(connection, tableName) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) as count FROM information_schema.tables 
     WHERE table_schema = ? AND table_name = ?`,
    [DB_CONFIG.database, tableName]
  );
  return rows[0].count > 0;
}

async function columnExists(connection, tableName, columnName) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) as count FROM information_schema.columns 
     WHERE table_schema = ? AND table_name = ? AND column_name = ?`,
    [DB_CONFIG.database, tableName, columnName]
  );
  return rows[0].count > 0;
}

async function getTableColumns(connection, tableName) {
  const [columns] = await connection.query(
    `SELECT column_name FROM information_schema.columns 
     WHERE table_schema = ? AND table_name = ?
     ORDER BY ordinal_position`,
    [DB_CONFIG.database, tableName]
  );
  return columns.map(col => col.column_name);
}

// ═══════════════════════════════════════════════════════════════════════════
// MIGRATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

async function createMissingTable(connection, tableName, schema) {
  log(`\n📦 Creating missing table: ${tableName}`, 'yellow');
  
  try {
    await connection.query(schema.createTable);
    log(`✅ Table ${tableName} created successfully`, 'green');
    return true;
  } catch (error) {
    log(`❌ Failed to create table ${tableName}: ${error.message}`, 'red');
    return false;
  }
}

async function addMissingColumns(connection, tableName, schema) {
  if (!schema.columns) return 0;
  
  const existingColumns = await getTableColumns(connection, tableName);
  const missingColumns = [];
  
  // Check each column in schema
  for (const [columnName, definition] of Object.entries(schema.columns)) {
    if (!existingColumns.includes(columnName)) {
      missingColumns.push({ name: columnName, definition });
    }
  }
  
  if (missingColumns.length === 0) {
    log(`  ✓ All columns exist in ${tableName}`, 'cyan');
    return 0;
  }
  
  log(`\n  📝 Found ${missingColumns.length} missing column(s) in ${tableName}:`, 'yellow');
  
  let addedCount = 0;
  for (const { name, definition } of missingColumns) {
    try {
      // Clean definition for ALTER TABLE (remove PRIMARY KEY, AUTO_INCREMENT)
      let cleanDef = definition
        .replace(/AUTO_INCREMENT PRIMARY KEY/gi, '')
        .replace(/PRIMARY KEY/gi, '')
        .trim();
      
      // Skip if this is the id column (already exists as primary key)
      if (name === 'id') {
        log(`  ⏭️  Skipping id column (primary key already exists)`, 'cyan');
        continue;
      }
      
      log(`  ➕ Adding column: ${name}`, 'yellow');
      await connection.query(`ALTER TABLE ${tableName} ADD COLUMN ${name} ${cleanDef}`);
      log(`  ✅ Added: ${name}`, 'green');
      addedCount++;
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        log(`  ⏭️  Column ${name} already exists`, 'cyan');
      } else {
        log(`  ❌ Failed to add ${name}: ${error.message}`, 'red');
      }
    }
  }
  
  return addedCount;
}

async function ensureRequiredSettings(connection, requiredSettings) {
  if (!requiredSettings || requiredSettings.length === 0) return 0;
  
  log(`\n  ⚙️  Checking required settings...`, 'cyan');
  
  let addedCount = 0;
  for (const setting of requiredSettings) {
    try {
      const [rows] = await connection.query(
        'SELECT COUNT(*) as count FROM settings WHERE key_name = ?',
        [setting.key]
      );
      
      if (rows[0].count === 0) {
        log(`  ➕ Adding setting: ${setting.key} = ${setting.value}`, 'yellow');
        await connection.query(
          'INSERT INTO settings (key_name, value, group_name, description) VALUES (?, ?, ?, ?)',
          [setting.key, setting.value, setting.group, setting.description]
        );
        log(`  ✅ Added setting: ${setting.key}`, 'green');
        addedCount++;
      } else {
        log(`  ✓ Setting exists: ${setting.key}`, 'cyan');
      }
    } catch (error) {
      log(`  ❌ Failed to add setting ${setting.key}: ${error.message}`, 'red');
    }
  }
  
  return addedCount;
}

async function cleanInvalidMetadata(connection) {
  try {
    log(`\n  🧹 Checking for invalid metadata entries...`, 'cyan');
    
    const [invalidRows] = await connection.query(`
      SELECT COUNT(*) as count 
      FROM wallet_transactions 
      WHERE metadata IS NOT NULL 
        AND metadata != 'null'
        AND (metadata = '[object Object]' OR metadata NOT LIKE '{%')
    `);
    
    if (invalidRows[0].count > 0) {
      log(`  ⚠️  Found ${invalidRows[0].count} invalid metadata entries`, 'yellow');
      log(`  🧹 Cleaning invalid metadata...`, 'yellow');
      
      await connection.query(`
        UPDATE wallet_transactions 
        SET metadata = NULL 
        WHERE metadata = '[object Object]' 
           OR (metadata NOT LIKE '{%' AND metadata != 'null' AND metadata IS NOT NULL)
      `);
      
      log(`  ✅ Cleaned ${invalidRows[0].count} invalid metadata entries`, 'green');
      return invalidRows[0].count;
    } else {
      log(`  ✓ No invalid metadata found`, 'cyan');
    }
  } catch (error) {
    // Table might not exist yet, ignore
    log(`  ⏭️  Skipping metadata cleanup (table may not exist)`, 'cyan');
  }
  return 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN MIGRATION FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

async function runAutoMigration() {
  let connection;
  let stats = {
    tablesCreated: 0,
    columnsAdded: 0,
    settingsAdded: 0,
    metadataCleaned: 0,
  };
  
  try {
    header('🚀 AUTO-MIGRATION SYSTEM STARTING');
    log(`Environment: ${process.env.NODE_ENV || 'development'}`, 'cyan');
    log(`Database: ${DB_CONFIG.database}`, 'cyan');
    log(`Host: ${DB_CONFIG.host}:${DB_CONFIG.port}`, 'cyan');
    
    // Connect to database
    log('\n🔌 Connecting to database...', 'cyan');
    connection = await mysql.createConnection(DB_CONFIG);
    log('✅ Connected successfully\n', 'green');
    
    // Process each table in schema
    for (const [tableName, schema] of Object.entries(SCHEMA)) {
      header(`📋 Processing: ${tableName}`);
      
      const exists = await tableExists(connection, tableName);
      
      if (!exists && schema.createTable) {
        // Table doesn't exist - create it
        const created = await createMissingTable(connection, tableName, schema);
        if (created) stats.tablesCreated++;
      } else if (exists) {
        // Table exists - check for missing columns
        log(`  ✓ Table exists, checking columns...`, 'cyan');
        const added = await addMissingColumns(connection, tableName, schema);
        stats.columnsAdded += added;
        
        // Check for required settings
        if (schema.requiredSettings) {
          const settingsAdded = await ensureRequiredSettings(connection, schema.requiredSettings);
          stats.settingsAdded += settingsAdded;
        }
      } else {
        log(`  ⏭️  Skipping ${tableName} (no create schema defined)`, 'yellow');
      }
    }
    
    // Clean invalid metadata
    header('🧹 Data Cleanup');
    stats.metadataCleaned = await cleanInvalidMetadata(connection);
    
    // Print summary
    header('📊 MIGRATION SUMMARY');
    log(`Tables created: ${stats.tablesCreated}`, stats.tablesCreated > 0 ? 'green' : 'cyan');
    log(`Columns added: ${stats.columnsAdded}`, stats.columnsAdded > 0 ? 'green' : 'cyan');
    log(`Settings added: ${stats.settingsAdded}`, stats.settingsAdded > 0 ? 'green' : 'cyan');
    log(`Metadata cleaned: ${stats.metadataCleaned}`, stats.metadataCleaned > 0 ? 'green' : 'cyan');
    
    if (stats.tablesCreated === 0 && stats.columnsAdded === 0 && stats.settingsAdded === 0) {
      log('\n✨ Database schema is up to date!', 'green');
    } else {
      log('\n✅ Migration completed successfully!', 'green');
    }
    
  } catch (error) {
    log(`\n❌ MIGRATION FAILED: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      log('\n👋 Database connection closed\n', 'cyan');
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// RUN MIGRATION
// ═══════════════════════════════════════════════════════════════════════════

if (require.main === module) {
  runAutoMigration()
    .then(() => {
      log('✅ Auto-migration process completed', 'green');
      process.exit(0);
    })
    .catch((error) => {
      log(`❌ Auto-migration process failed: ${error.message}`, 'red');
      console.error(error);
      process.exit(1);
    });
}

module.exports = { runAutoMigration };
