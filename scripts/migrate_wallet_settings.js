/**
 * Migration: Add Minimum Withdrawal Amount Setting
 * 
 * Adds partner_minimum_withdrawal_amount to settings table
 * This defines the minimum amount a partner can request for withdrawal
 */

const mysql = require('mysql2/promise');
const path = require('path');

// Load the correct env file based on NODE_ENV
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local';
const envPath = path.resolve(process.cwd(), envFile);

// Only load .env file if it exists
if (require('fs').existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'linko',
};

async function migrate() {
  let connection;
  
  try {
    console.log('🔄 Connecting to database...');
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ Connected to database');

    // Check if setting already exists
    const [existing] = await connection.query(
      `SELECT COUNT(*) as count FROM settings WHERE key_name = 'partner_minimum_withdrawal_amount'`
    );

    if (existing[0].count > 0) {
      console.log('⏭️  Setting already exists, skipping...');
      return;
    }

    // Insert minimum withdrawal amount setting
    await connection.query(`
      INSERT INTO settings (key_name, value, group_name)
      VALUES (
        'partner_minimum_withdrawal_amount',
        '100',
        'wallet'
      )
    `);

    console.log('✅ Added partner_minimum_withdrawal_amount setting (default: ₹100)');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run migration if called directly
if (require.main === module) {
  migrate()
    .then(() => {
      console.log('✅ Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = migrate;
