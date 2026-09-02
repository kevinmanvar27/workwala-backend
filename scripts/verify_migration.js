/**
 * Verification Script: Check wallet_transactions Migration
 * 
 * This script verifies that the wallet_transactions table structure
 * matches the partners table foreign key requirements.
 * 
 * Run this after deployment to verify everything is working.
 */

const mysql = require('mysql2/promise');
const path = require('path');

// Load environment variables
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local';
const envPath = path.resolve(process.cwd(), envFile);

if (require('fs').existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });
}

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'linko',
};

async function verify() {
  let connection;
  
  try {
    console.log('🔍 Verifying wallet_transactions migration...\n');
    
    // Connect to database
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ Connected to database:', DB_CONFIG.database);
    
    // Check if migrations table exists
    const [migrationsTables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'migrations'
    `);
    
    if (migrationsTables.length === 0) {
      console.log('❌ migrations table does not exist');
      console.log('   Run: npm run migrate:auto');
      return;
    }
    console.log('✅ migrations table exists');
    
    // Check if wallet_transactions migration is recorded
    const [migrationRecords] = await connection.query(`
      SELECT name, executed_at, status, error_message 
      FROM migrations 
      WHERE name = 'wallet_transactions'
    `);
    
    if (migrationRecords.length === 0) {
      console.log('⚠️  wallet_transactions migration not recorded');
      console.log('   Status: Not executed yet');
    } else {
      const record = migrationRecords[0];
      if (record.status === 'success') {
        console.log('✅ wallet_transactions migration recorded as SUCCESS');
        console.log(`   Executed at: ${record.executed_at}`);
      } else {
        console.log('❌ wallet_transactions migration recorded as FAILED');
        console.log(`   Error: ${record.error_message}`);
      }
    }
    
    // Check if wallet_transactions table exists
    const [walletTables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'wallet_transactions'
    `);
    
    if (walletTables.length === 0) {
      console.log('\n❌ wallet_transactions table does NOT exist');
      console.log('\n📋 Manual Fix Required:');
      console.log('   1. Go to: https://auth-db833.hstgr.io/');
      console.log('   2. Select database: u122886170_linko');
      console.log('   3. Run the SQL from DEPLOYMENT_FIX.md');
      return;
    }
    
    console.log('✅ wallet_transactions table exists\n');
    
    // Check table structure
    console.log('📊 Checking table structure...');
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY, COLUMN_DEFAULT
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'wallet_transactions'
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('\n   Columns:');
    columns.forEach(col => {
      console.log(`   - ${col.COLUMN_NAME}: ${col.COLUMN_TYPE} ${col.IS_NULLABLE === 'NO' ? 'NOT NULL' : 'NULL'} ${col.COLUMN_KEY ? `[${col.COLUMN_KEY}]` : ''}`);
    });
    
    // Check foreign key constraint
    const [foreignKeys] = await connection.query(`
      SELECT 
        CONSTRAINT_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'wallet_transactions'
      AND REFERENCED_TABLE_NAME IS NOT NULL
    `);
    
    if (foreignKeys.length === 0) {
      console.log('\n⚠️  No foreign key constraints found');
      console.log('   This might be okay if constraints were skipped');
    } else {
      console.log('\n✅ Foreign key constraints:');
      foreignKeys.forEach(fk => {
        console.log(`   - ${fk.CONSTRAINT_NAME}: ${fk.COLUMN_NAME} -> ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`);
      });
    }
    
    // Verify partner_id column type matches partners.id
    console.log('\n🔍 Verifying column type compatibility...');
    
    const [partnerIdType] = await connection.query(`
      SELECT COLUMN_TYPE 
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'partners'
      AND COLUMN_NAME = 'id'
    `);
    
    const [walletPartnerIdType] = await connection.query(`
      SELECT COLUMN_TYPE 
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'wallet_transactions'
      AND COLUMN_NAME = 'partner_id'
    `);
    
    if (partnerIdType.length > 0 && walletPartnerIdType.length > 0) {
      const partnersType = partnerIdType[0].COLUMN_TYPE;
      const walletType = walletPartnerIdType[0].COLUMN_TYPE;
      
      console.log(`   partners.id: ${partnersType}`);
      console.log(`   wallet_transactions.partner_id: ${walletType}`);
      
      if (partnersType === walletType) {
        console.log('   ✅ Column types MATCH - Foreign key will work!');
      } else {
        console.log('   ⚠️  Column types DO NOT MATCH - Foreign key might fail!');
      }
    }
    
    // Check if there are any transactions
    const [transactionCount] = await connection.query(`
      SELECT COUNT(*) as count FROM wallet_transactions
    `);
    
    console.log(`\n📈 Transaction count: ${transactionCount[0].count}`);
    
    if (transactionCount[0].count > 0) {
      console.log('\n📋 Recent transactions:');
      const [recentTransactions] = await connection.query(`
        SELECT 
          id, 
          partner_id, 
          type, 
          amount, 
          balance_after,
          created_at
        FROM wallet_transactions
        ORDER BY created_at DESC
        LIMIT 5
      `);
      
      console.table(recentTransactions);
    }
    
    // Check partners with balance
    const [partnersWithBalance] = await connection.query(`
      SELECT 
        id, 
        name, 
        phone, 
        balance,
        status
      FROM partners
      WHERE balance > 0
      ORDER BY balance DESC
      LIMIT 10
    `);
    
    if (partnersWithBalance.length > 0) {
      console.log('\n💰 Partners with balance:');
      console.table(partnersWithBalance);
    } else {
      console.log('\n💰 No partners with balance yet');
    }
    
    console.log('\n✅ Verification complete!');
    console.log('\n📝 Next steps:');
    console.log('   1. Complete a test booking with online payment');
    console.log('   2. Check partner balance updates');
    console.log('   3. Verify transaction is recorded in wallet_transactions');
    
  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Database connection refused');
      console.log('   - Check if MySQL is running');
      console.log('   - Verify DB_HOST, DB_PORT, DB_USER, DB_PASSWORD in .env');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('\n💡 Access denied');
      console.log('   - Check DB_USER and DB_PASSWORD in .env');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.log('\n💡 Database does not exist');
      console.log('   - Check DB_NAME in .env');
      console.log('   - Run migrations to create database');
    }
    
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n👋 Database connection closed');
    }
  }
}

// Run verification if called directly
if (require.main === module) {
  verify()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Verification error:', error);
      process.exit(1);
    });
}

module.exports = verify;
