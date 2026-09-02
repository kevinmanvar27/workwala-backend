/**
 * Migration: Create wallet_transactions table
 * 
 * This migration creates the wallet_transactions table for tracking all partner wallet operations:
 * - Earnings from completed bookings
 * - Fee deductions (platform + task fees)
 * - Withdrawals
 * - Top-ups
 * - Refunds and penalties
 * 
 * The table includes metadata field for storing transaction details (fees, amounts, etc.)
 * and tracks balance before/after each transaction for audit purposes.
 */

const mysql = require('mysql2/promise');
const path = require('path');

// Load environment variables
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local';
const envPath = path.resolve(__dirname, '..', envFile);

// Only load .env file if it exists (production might use environment variables directly)
if (require('fs').existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  // In production on Hostinger, environment variables are set directly
  require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
}

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'linko',
  multipleStatements: true
};

async function migrate() {
  let connection;
  
  try {
    console.log('🚀 Starting wallet_transactions table migration...');
    
    // Connect to database
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ Connected to database');

    // Create wallet_transactions table
    // Note: partner_id must be INT (signed) to match partners.id column type
    await connection.query(`
      CREATE TABLE IF NOT EXISTS wallet_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        partner_id INT NOT NULL,
        type ENUM('earning', 'fee_deduction', 'withdrawal', 'topup', 'refund', 'penalty') NOT NULL,
        amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        description TEXT NOT NULL,
        reference_type VARCHAR(50) DEFAULT NULL COMMENT 'e.g., booking, withdrawal_request',
        reference_id INT DEFAULT NULL COMMENT 'ID of the related record',
        payment_method VARCHAR(50) DEFAULT NULL COMMENT 'online, cash, bank_transfer, etc.',
        balance_before DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        balance_after DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        metadata JSON DEFAULT NULL COMMENT 'Additional transaction details (fees, amounts, etc.)',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_partner_id (partner_id),
        KEY idx_type (type),
        KEY idx_reference (reference_type, reference_id),
        KEY idx_created_at (created_at),
        CONSTRAINT fk_wallet_transactions_partner FOREIGN KEY (partner_id) REFERENCES partners (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Created wallet_transactions table');

    // Add index for faster queries on pending fees calculation
    // This index helps with queries that check fees_pending in metadata
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_partner_type_metadata 
      ON wallet_transactions (partner_id, type, (CAST(JSON_EXTRACT(metadata, '$.fees_pending') AS UNSIGNED)))
    `).catch(err => {
      // Ignore error if index already exists or if MySQL version doesn't support functional indexes
      console.log('ℹ️  Skipped functional index (may not be supported on this MySQL version)');
    });

    console.log('✅ Migration completed successfully');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('👋 Database connection closed');
    }
  }
}

// Run migration if called directly
if (require.main === module) {
  migrate()
    .then(() => {
      console.log('✨ Wallet transactions migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = migrate;
