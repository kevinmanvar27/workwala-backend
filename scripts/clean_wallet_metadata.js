#!/usr/bin/env node

/**
 * Clean Invalid Metadata in wallet_transactions
 * 
 * This script fixes metadata entries that are stored as "[object Object]" 
 * or other invalid formats that cause JSON parsing errors.
 */

const mysql = require('mysql2/promise');
const path = require('path');

// Load environment
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local';
const envPath = path.resolve(process.cwd(), envFile);

if (require('fs').existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'workwala',
};

async function cleanMetadata() {
  let connection;
  
  try {
    console.log('\n🧹 WALLET METADATA CLEANUP SCRIPT');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // Connect to database
    console.log(`📡 Connecting to database: ${DB_CONFIG.database}`);
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ Connected\n');
    
    // Check for invalid metadata
    console.log('🔍 Checking for invalid metadata entries...');
    const [invalidRows] = await connection.query(`
      SELECT 
        id,
        partner_id,
        type,
        amount,
        metadata,
        created_at
      FROM wallet_transactions 
      WHERE metadata IS NOT NULL 
        AND metadata != 'null'
        AND (
          metadata = '[object Object]' 
          OR metadata NOT LIKE '{%'
          OR metadata LIKE '%[object Object]%'
        )
      ORDER BY created_at DESC
    `);
    
    if (invalidRows.length === 0) {
      console.log('✅ No invalid metadata found! Database is clean.\n');
      return;
    }
    
    console.log(`⚠️  Found ${invalidRows.length} transactions with invalid metadata:\n`);
    
    // Display invalid entries
    invalidRows.forEach((row, index) => {
      console.log(`${index + 1}. Transaction #${row.id}`);
      console.log(`   Partner: ${row.partner_id}`);
      console.log(`   Type: ${row.type}`);
      console.log(`   Amount: ₹${row.amount}`);
      console.log(`   Invalid Metadata: "${row.metadata}"`);
      console.log(`   Date: ${row.created_at}`);
      console.log('');
    });
    
    // Clean invalid metadata
    console.log('🧹 Cleaning invalid metadata entries...');
    const [result] = await connection.query(`
      UPDATE wallet_transactions 
      SET metadata = NULL 
      WHERE metadata = '[object Object]' 
         OR (metadata NOT LIKE '{%' AND metadata != 'null' AND metadata IS NOT NULL)
         OR metadata LIKE '%[object Object]%'
    `);
    
    console.log(`✅ Cleaned ${result.affectedRows} entries`);
    console.log('\n✨ Database cleanup complete!\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('👋 Connection closed\n');
    }
  }
}

// Run the cleanup
if (require.main === module) {
  cleanMetadata()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { cleanMetadata };
