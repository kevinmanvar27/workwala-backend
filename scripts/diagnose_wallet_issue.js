/**
 * Diagnostic Script for Wallet API 500 Error
 * 
 * This script helps diagnose why the wallet API is returning 500 error
 * for partner 26 on production.
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
  database: process.env.DB_NAME || 'workwala',
};

async function diagnoseWalletIssue() {
  let connection;
  
  try {
    console.log('🔄 Connecting to database...');
    console.log(`   Host: ${DB_CONFIG.host}`);
    console.log(`   Database: ${DB_CONFIG.database}`);
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ Connected to database\n');

    // Check if partner 26 exists
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('1️⃣  CHECKING PARTNER 26');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const [partners] = await connection.query(
      'SELECT id, name, phone, balance FROM partners WHERE id = 26'
    );

    if (partners.length === 0) {
      console.log('❌ Partner 26 NOT FOUND in database!');
      console.log('   This might be a production vs local database issue.\n');
      return;
    }

    const partner = partners[0];
    console.log('✅ Partner Found:');
    console.log(`   ID: ${partner.id}`);
    console.log(`   Name: ${partner.name}`);
    console.log(`   Phone: ${partner.phone}`);
    console.log(`   Balance: ₹${partner.balance}\n`);

    // Check wallet settings
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('2️⃣  CHECKING WALLET SETTINGS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const [settings] = await connection.query(`
      SELECT key_name, value 
      FROM settings 
      WHERE key_name IN (
        'partner_minimum_wallet_balance',
        'partner_minimum_withdrawal_amount',
        'partner_platform_fee_type',
        'partner_platform_fee_value',
        'partner_task_fee'
      )
      ORDER BY key_name
    `);

    if (settings.length === 0) {
      console.log('❌ No wallet settings found! This will cause errors.\n');
    } else {
      console.log('✅ Wallet Settings:');
      settings.forEach(s => {
        console.log(`   ${s.key_name}: ${s.value}`);
      });
      console.log();
    }

    // Check wallet transactions
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('3️⃣  CHECKING WALLET TRANSACTIONS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const [transactions] = await connection.query(`
      SELECT id, type, amount, reference_type, reference_id, 
             LEFT(metadata, 150) as metadata_preview,
             created_at
      FROM wallet_transactions 
      WHERE partner_id = 26 
      ORDER BY created_at DESC
      LIMIT 20
    `);

    console.log(`Found ${transactions.length} transactions for partner 26:\n`);
    
    if (transactions.length === 0) {
      console.log('⚠️  No transactions found. This is unusual if partner has balance.\n');
    } else {
      transactions.forEach((t, index) => {
        console.log(`${index + 1}. Transaction ID: ${t.id}`);
        console.log(`   Type: ${t.type}`);
        console.log(`   Amount: ₹${t.amount}`);
        console.log(`   Reference: ${t.reference_type} #${t.reference_id || 'N/A'}`);
        console.log(`   Metadata: ${t.metadata_preview || 'NULL'}`);
        console.log(`   Created: ${t.created_at}`);
        console.log();
      });
    }

    // Check for invalid metadata
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('4️⃣  CHECKING FOR INVALID METADATA');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const [invalidMetadata] = await connection.query(`
      SELECT id, type, amount, metadata
      FROM wallet_transactions
      WHERE partner_id = 26
        AND type = 'earning'
        AND reference_type = 'booking'
        AND metadata IS NOT NULL
        AND (
          metadata = '[object Object]'
          OR metadata NOT LIKE '{%'
        )
    `);

    if (invalidMetadata.length === 0) {
      console.log('✅ No invalid metadata found. All earning transactions have valid JSON.\n');
    } else {
      console.log(`❌ Found ${invalidMetadata.length} transactions with INVALID metadata:\n`);
      invalidMetadata.forEach((t, index) => {
        console.log(`${index + 1}. Transaction ID: ${t.id}`);
        console.log(`   Type: ${t.type}`);
        console.log(`   Amount: ₹${t.amount}`);
        console.log(`   Metadata: "${t.metadata}"`);
        console.log(`   ⚠️  THIS WILL CAUSE JSON PARSE ERROR!\n`);
      });
      
      console.log('💡 SOLUTION: Run the fix script:');
      console.log('   node scripts/fix_wallet_metadata.js\n');
    }

    // Test metadata parsing
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('5️⃣  TESTING METADATA PARSING');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const [earningTransactions] = await connection.query(`
      SELECT id, reference_id, metadata
      FROM wallet_transactions
      WHERE partner_id = 26
        AND type = 'earning'
        AND reference_type = 'booking'
        AND metadata IS NOT NULL
    `);

    console.log(`Testing ${earningTransactions.length} earning transactions:\n`);
    
    let validCount = 0;
    let invalidCount = 0;
    let totalPendingFees = 0;
    
    earningTransactions.forEach((t, index) => {
      try {
        let meta;
        if (typeof t.metadata === 'string') {
          if (t.metadata.startsWith('{') || t.metadata.startsWith('[')) {
            meta = JSON.parse(t.metadata);
            validCount++;
            console.log(`✅ Transaction ${t.id}: Valid JSON`);
            console.log(`   Platform Fee: ₹${meta.platform_fee || 0}`);
            console.log(`   Task Fee: ₹${meta.task_fee || 0}`);
            console.log(`   Fees Pending: ${meta.fees_pending || 'not set'}\n`);
            
            if (meta.fees_pending === true) {
              totalPendingFees += (meta.platform_fee || 0) + (meta.task_fee || 0);
            }
          } else {
            invalidCount++;
            console.log(`❌ Transaction ${t.id}: Invalid JSON format`);
            console.log(`   Metadata: "${t.metadata}"\n`);
          }
        } else if (typeof t.metadata === 'object') {
          meta = t.metadata;
          validCount++;
          console.log(`✅ Transaction ${t.id}: Already parsed object`);
          console.log(`   Platform Fee: ₹${meta.platform_fee || 0}`);
          console.log(`   Task Fee: ₹${meta.task_fee || 0}\n`);
        }
      } catch (error) {
        invalidCount++;
        console.log(`❌ Transaction ${t.id}: Parse error`);
        console.log(`   Error: ${error.message}`);
        console.log(`   Metadata: "${t.metadata}"\n`);
      }
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log(`Partner: ${partner.name} (ID: ${partner.id})`);
    console.log(`Current Balance: ₹${partner.balance}`);
    console.log(`Total Transactions: ${transactions.length}`);
    console.log(`Earning Transactions: ${earningTransactions.length}`);
    console.log(`Valid Metadata: ${validCount}`);
    console.log(`Invalid Metadata: ${invalidCount}`);
    console.log(`Total Pending Fees: ₹${totalPendingFees}`);
    
    if (invalidCount > 0) {
      console.log('\n⚠️  ACTION REQUIRED:');
      console.log('   The wallet API will return 500 error due to invalid metadata.');
      console.log('   Run: node scripts/fix_wallet_metadata.js');
    } else {
      console.log('\n✅ All checks passed! Wallet API should work correctly.');
      console.log('   If still getting 500 error, check:');
      console.log('   1. Production server has restarted with latest code');
      console.log('   2. Authentication token is valid');
      console.log('   3. Check production server logs for actual error');
    }

  } catch (error) {
    console.error('\n❌ Diagnostic failed:', error.message);
    console.error('Stack trace:', error.stack);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Run diagnostic if called directly
if (require.main === module) {
  diagnoseWalletIssue()
    .then(() => {
      console.log('\n✅ Diagnostic completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Diagnostic failed:', error);
      process.exit(1);
    });
}

module.exports = diagnoseWalletIssue;
