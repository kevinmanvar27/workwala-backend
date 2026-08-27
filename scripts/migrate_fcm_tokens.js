/**
 * Migration: Add fcm_token column to partners and customers tables
 * Run: node scripts/migrate_fcm_tokens.js
 */

const mysql = require('mysql2/promise');
const path = require('path');

// Load the correct env file based on NODE_ENV
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local';
require('dotenv').config({ path: path.resolve(process.cwd(), envFile) });

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'workwala',
};

async function migrate() {
  let connection;
  try {
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ Connected to MySQL');

    // Check if fcm_token column exists in partners table
    const [partnersColumns] = await connection.query(
      `SHOW COLUMNS FROM partners LIKE 'fcm_token'`
    );

    if (partnersColumns.length === 0) {
      console.log('📝 Adding fcm_token column to partners table...');
      await connection.query(`
        ALTER TABLE partners 
        ADD COLUMN fcm_token VARCHAR(500) NULL DEFAULT NULL AFTER phone,
        ADD INDEX idx_partners_fcm_token (fcm_token)
      `);
      console.log('✅ Added fcm_token column to partners table');
    } else {
      console.log('ℹ️  fcm_token column already exists in partners table');
    }

    // Check if fcm_token column exists in customers table
    const [customersColumns] = await connection.query(
      `SHOW COLUMNS FROM customers LIKE 'fcm_token'`
    );

    if (customersColumns.length === 0) {
      console.log('📝 Adding fcm_token column to customers table...');
      await connection.query(`
        ALTER TABLE customers 
        ADD COLUMN fcm_token VARCHAR(500) NULL DEFAULT NULL AFTER phone,
        ADD INDEX idx_customers_fcm_token (fcm_token)
      `);
      console.log('✅ Added fcm_token column to customers table');
    } else {
      console.log('ℹ️  fcm_token column already exists in customers table');
    }

    console.log('');
    console.log('🎉 FCM token migration completed!');
    console.log('');
    console.log('🔧 Next steps:');
    console.log('   1. Run: node scripts/seed_firebase_credentials.js');
    console.log('   2. Configure Firebase credentials in Admin → Settings → Notifications');
    console.log('   3. Test push notifications in Admin → Notifications → Test Notification');

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

migrate();
