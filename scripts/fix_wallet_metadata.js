/**
 * Fix Invalid Metadata in wallet_transactions Table
 * 
 * This script finds and fixes wallet_transactions with invalid JSON metadata
 * (stored as "[object Object]" instead of proper JSON)
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

async function fixInvalidMetadata() {
  let connection;
  
  try {
    console.log('🔄 Connecting to database...');
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ Connected to database');

    // Find all transactions with invalid metadata
    const [invalidTransactions] = await connection.query(`
      SELECT id, partner_id, type, amount, metadata
      FROM wallet_transactions
      WHERE metadata IS NOT NULL
        AND (
          metadata = '[object Object]'
          OR metadata NOT LIKE '{%'
        )
    `);

    console.log(`\n🔍 Found ${invalidTransactions.length} transactions with invalid metadata`);

    if (invalidTransactions.length === 0) {
      console.log('✅ No invalid metadata found. All transactions are clean!');
      return;
    }

    // Display invalid transactions
    console.log('\n📋 Invalid Transactions:');
    invalidTransactions.forEach((t, index) => {
      console.log(`\n${index + 1}. Transaction ID: ${t.id}`);
      console.log(`   Partner ID: ${t.partner_id}`);
      console.log(`   Type: ${t.type}`);
      console.log(`   Amount: ₹${t.amount}`);
      console.log(`   Metadata: "${t.metadata}"`);
    });

    // Ask for confirmation (in production, you might want to auto-fix)
    console.log('\n⚠️  Options:');
    console.log('1. Set metadata to NULL (safest - removes invalid data)');
    console.log('2. Set metadata to empty JSON object {}');
    console.log('3. Skip fixing (just report)');

    // For automation, we'll set to NULL (safest option)
    const action = 'null'; // or 'empty' or 'skip'

    if (action === 'null') {
      console.log('\n🔧 Setting invalid metadata to NULL...');
      
      const [result] = await connection.query(`
        UPDATE wallet_transactions
        SET metadata = NULL
        WHERE metadata IS NOT NULL
          AND (
            metadata = '[object Object]'
            OR metadata NOT LIKE '{%'
          )
      `);

      console.log(`✅ Updated ${result.affectedRows} transactions`);
    } else if (action === 'empty') {
      console.log('\n🔧 Setting invalid metadata to empty JSON object...');
      
      const [result] = await connection.query(`
        UPDATE wallet_transactions
        SET metadata = '{}'
        WHERE metadata IS NOT NULL
          AND (
            metadata = '[object Object]'
            OR metadata NOT LIKE '{%'
          )
      `);

      console.log(`✅ Updated ${result.affectedRows} transactions`);
    } else {
      console.log('\n⏭️  Skipping fix. No changes made.');
    }

    // Verify fix
    const [remainingInvalid] = await connection.query(`
      SELECT COUNT(*) as count
      FROM wallet_transactions
      WHERE metadata IS NOT NULL
        AND (
          metadata = '[object Object]'
          OR metadata NOT LIKE '{%'
        )
    `);

    console.log(`\n📊 Remaining invalid transactions: ${remainingInvalid[0].count}`);

  } catch (error) {
    console.error('❌ Fix failed:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run fix if called directly
if (require.main === module) {
  fixInvalidMetadata()
    .then(() => {
      console.log('\n✅ Fix completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Fix failed:', error);
      process.exit(1);
    });
}

module.exports = fixInvalidMetadata;
