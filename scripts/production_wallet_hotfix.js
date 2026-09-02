#!/usr/bin/env node

/**
 * Production Hotfix for Wallet API 500 Error
 * 
 * This script:
 * 1. Diagnoses the wallet issue for partner 26
 * 2. Fixes invalid metadata if found
 * 3. Verifies the fix
 * 4. Provides next steps
 * 
 * Usage:
 *   NODE_ENV=production node scripts/production_wallet_hotfix.js
 */

const mysql = require('mysql2/promise');
const path = require('path');
const readline = require('readline');

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

const PARTNER_ID = 26; // Developer RekTech
const PARTNER_PHONE = '8690203040';

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function header(title) {
  console.log('\n' + '═'.repeat(60));
  log(title, 'bright');
  console.log('═'.repeat(60) + '\n');
}

async function askQuestion(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function runHotfix() {
  let connection;
  let issuesFound = false;
  let fixesApplied = false;

  try {
    // Connect to database
    header('🔌 CONNECTING TO DATABASE');
    log(`Host: ${DB_CONFIG.host}`, 'cyan');
    log(`Database: ${DB_CONFIG.database}`, 'cyan');
    log(`Environment: ${process.env.NODE_ENV || 'development'}`, 'cyan');
    
    connection = await mysql.createConnection(DB_CONFIG);
    log('\n✅ Connected successfully', 'green');

    // Step 1: Verify partner exists
    header('1️⃣  VERIFYING PARTNER');
    
    const [partners] = await connection.query(
      'SELECT id, name, phone, balance FROM partners WHERE id = ? OR phone = ?',
      [PARTNER_ID, PARTNER_PHONE]
    );

    if (partners.length === 0) {
      log(`❌ Partner ${PARTNER_ID} (${PARTNER_PHONE}) NOT FOUND!`, 'red');
      log('\nPossible reasons:', 'yellow');
      log('  • Wrong database (check DB_NAME in .env)', 'yellow');
      log('  • Partner ID is different in production', 'yellow');
      log('  • Database connection issue', 'yellow');
      return;
    }

    const partner = partners[0];
    log(`✅ Partner found: ${partner.name} (ID: ${partner.id})`, 'green');
    log(`   Phone: ${partner.phone}`, 'cyan');
    log(`   Current Balance: ₹${partner.balance}`, 'cyan');

    // Step 2: Check wallet settings
    header('2️⃣  CHECKING WALLET SETTINGS');
    
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

    if (settings.length < 5) {
      log('⚠️  Some wallet settings are missing!', 'yellow');
      issuesFound = true;
      
      log('\nFound settings:', 'cyan');
      settings.forEach(s => log(`  • ${s.key_name}: ${s.value}`, 'cyan'));
      
      log('\nMissing settings should be added via admin panel or migration.', 'yellow');
    } else {
      log('✅ All wallet settings configured', 'green');
      settings.forEach(s => log(`  • ${s.key_name}: ${s.value}`, 'cyan'));
    }

    // Step 3: Check for invalid metadata
    header('3️⃣  SCANNING FOR INVALID METADATA');
    
    const [invalidTransactions] = await connection.query(`
      SELECT id, type, amount, reference_type, reference_id, metadata
      FROM wallet_transactions
      WHERE partner_id = ?
        AND metadata IS NOT NULL
        AND (
          metadata = '[object Object]'
          OR (metadata NOT LIKE '{%' AND metadata NOT LIKE '[%')
        )
    `, [partner.id]);

    if (invalidTransactions.length > 0) {
      log(`❌ Found ${invalidTransactions.length} transaction(s) with INVALID metadata!`, 'red');
      issuesFound = true;
      
      log('\nInvalid transactions:', 'yellow');
      invalidTransactions.forEach((t, index) => {
        log(`\n${index + 1}. Transaction ID: ${t.id}`, 'yellow');
        log(`   Type: ${t.type}`, 'cyan');
        log(`   Amount: ₹${t.amount}`, 'cyan');
        log(`   Metadata: "${t.metadata}"`, 'red');
      });

      log('\n⚠️  This WILL cause 500 error in wallet API!', 'red');
      
      // Ask for confirmation to fix
      const answer = await askQuestion('\n🔧 Fix invalid metadata now? (yes/no): ');
      
      if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
        log('\n🔧 Fixing invalid metadata...', 'yellow');
        
        const [result] = await connection.query(`
          UPDATE wallet_transactions
          SET metadata = NULL
          WHERE partner_id = ?
            AND metadata IS NOT NULL
            AND (
              metadata = '[object Object]'
              OR (metadata NOT LIKE '{%' AND metadata NOT LIKE '[%')
            )
        `, [partner.id]);

        log(`✅ Fixed ${result.affectedRows} transaction(s)`, 'green');
        fixesApplied = true;
      } else {
        log('⏭️  Skipping fix. Issue remains!', 'yellow');
      }
    } else {
      log('✅ No invalid metadata found', 'green');
    }

    // Step 4: Test metadata parsing
    header('4️⃣  TESTING METADATA PARSING');
    
    const [earningTransactions] = await connection.query(`
      SELECT id, reference_id, metadata
      FROM wallet_transactions
      WHERE partner_id = ?
        AND type = 'earning'
        AND reference_type = 'booking'
        AND metadata IS NOT NULL
    `, [partner.id]);

    log(`Testing ${earningTransactions.length} earning transaction(s):\n`, 'cyan');
    
    let validCount = 0;
    let invalidCount = 0;
    let totalPendingFees = 0;
    let platformFees = 0;
    let taskFees = 0;

    earningTransactions.forEach((t) => {
      try {
        let meta;
        if (typeof t.metadata === 'string') {
          if (t.metadata.startsWith('{') || t.metadata.startsWith('[')) {
            meta = JSON.parse(t.metadata);
            validCount++;
            
            log(`✅ Transaction ${t.id}: Valid`, 'green');
            log(`   Platform Fee: ₹${meta.platform_fee || 0}`, 'cyan');
            log(`   Task Fee: ₹${meta.task_fee || 0}`, 'cyan');
            log(`   Fees Pending: ${meta.fees_pending || 'not set'}`, 'cyan');
            
            if (meta.fees_pending === true) {
              platformFees += meta.platform_fee || 0;
              taskFees += meta.task_fee || 0;
              totalPendingFees += (meta.platform_fee || 0) + (meta.task_fee || 0);
            }
          } else {
            invalidCount++;
            log(`❌ Transaction ${t.id}: Invalid format`, 'red');
            issuesFound = true;
          }
        } else if (typeof t.metadata === 'object') {
          meta = t.metadata;
          validCount++;
          log(`✅ Transaction ${t.id}: Valid (object)`, 'green');
        }
      } catch (error) {
        invalidCount++;
        log(`❌ Transaction ${t.id}: Parse error - ${error.message}`, 'red');
        issuesFound = true;
      }
    });

    // Step 5: Calculate expected balance
    header('5️⃣  CALCULATING EXPECTED BALANCE');
    
    const minimumBalance = parseFloat(settings.find(s => s.key_name === 'partner_minimum_wallet_balance')?.value || 200);
    const availableForWithdrawal = Math.max(0, partner.balance - minimumBalance - totalPendingFees);

    log(`Current Balance: ₹${partner.balance}`, 'cyan');
    log(`Minimum Required: ₹${minimumBalance}`, 'cyan');
    log(`Pending Platform Fees: ₹${platformFees}`, 'cyan');
    log(`Pending Task Fees: ₹${taskFees}`, 'cyan');
    log(`Total Pending Fees: ₹${totalPendingFees}`, 'cyan');
    log(`Available for Withdrawal: ₹${availableForWithdrawal}`, 'green');

    // Final Summary
    header('📊 SUMMARY');
    
    log(`Partner: ${partner.name} (ID: ${partner.id})`, 'bright');
    log(`Total Transactions: ${earningTransactions.length}`, 'cyan');
    log(`Valid Metadata: ${validCount}`, 'green');
    log(`Invalid Metadata: ${invalidCount}`, invalidCount > 0 ? 'red' : 'green');
    log(`Issues Found: ${issuesFound ? 'YES' : 'NO'}`, issuesFound ? 'red' : 'green');
    log(`Fixes Applied: ${fixesApplied ? 'YES' : 'NO'}`, fixesApplied ? 'green' : 'yellow');

    // Recommendations
    header('💡 RECOMMENDATIONS');
    
    if (!issuesFound && !fixesApplied) {
      log('✅ No issues found! Wallet API should work correctly.', 'green');
      log('\nIf still getting 500 error, check:', 'cyan');
      log('  1. Production server has latest code (commit 904e6b2+)', 'cyan');
      log('  2. Server has been restarted to load new code', 'cyan');
      log('  3. Authentication token is valid', 'cyan');
      log('  4. Check production server logs for actual error', 'cyan');
    } else if (fixesApplied) {
      log('✅ Fixes have been applied!', 'green');
      log('\nNext steps:', 'cyan');
      log('  1. Test wallet API endpoint', 'cyan');
      log('  2. Try opening withdrawal modal in app', 'cyan');
      log('  3. Monitor production logs for any new errors', 'cyan');
      log('\nIf issue persists, restart production server:', 'yellow');
      log('  pm2 restart workwala-backend', 'yellow');
      log('  OR: systemctl restart workwala-backend', 'yellow');
    } else if (issuesFound) {
      log('⚠️  Issues found but not fixed!', 'yellow');
      log('\nRun this script again and choose "yes" to fix.', 'yellow');
      log('Or manually fix using:', 'yellow');
      log('  node scripts/fix_wallet_metadata.js', 'yellow');
    }

    // Test API endpoint
    header('🧪 TEST API ENDPOINT');
    log('To test the wallet API:', 'cyan');
    log('\n  curl -H "Authorization: Bearer YOUR_TOKEN" \\', 'yellow');
    log(`       ${process.env.NEXTAUTH_URL || 'https://joinlinko.com'}/api/partner/wallet`, 'yellow');
    log('\nExpected response: 200 OK with balance and settings', 'cyan');

  } catch (error) {
    log('\n❌ HOTFIX FAILED', 'red');
    log(`Error: ${error.message}`, 'red');
    console.error('\nStack trace:', error.stack);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      log('\n🔌 Database connection closed', 'cyan');
    }
  }
}

// Run hotfix if called directly
if (require.main === module) {
  log('\n╔════════════════════════════════════════════════════════════╗', 'bright');
  log('║     PRODUCTION WALLET API HOTFIX - Partner 26              ║', 'bright');
  log('╚════════════════════════════════════════════════════════════╝', 'bright');
  
  runHotfix()
    .then(() => {
      log('\n✅ Hotfix completed', 'green');
      process.exit(0);
    })
    .catch((error) => {
      log('\n❌ Hotfix failed', 'red');
      console.error(error);
      process.exit(1);
    });
}

module.exports = runHotfix;
