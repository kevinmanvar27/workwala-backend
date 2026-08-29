/**
 * Import ARB Translation Files to Database
 * 
 * This script reads existing ARB files from Flutter app and imports them
 * into the MySQL database for dynamic translation management.
 * 
 * Usage: node scripts/import_arb_to_db.js
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

// Database connection
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'linko',
  charset: 'utf8mb4',
};

// ARB file paths (relative to project root)
const ARB_FILES = {
  en: '../Work-Wala-Partner/lib/l10n/app_en.arb',
  hi: '../Work-Wala-Partner/lib/l10n/app_hi.arb',
  gu: '../Work-Wala-Partner/lib/l10n/app_gu.arb',
  mr: '../Work-Wala-Partner/lib/l10n/app_mr.arb',
};

// Category mapping based on key patterns
function getCategoryFromKey(key) {
  if (key.includes('auth') || key.includes('login') || key.includes('otp') || key.includes('phone')) {
    return 'auth';
  }
  if (key.includes('profile') || key.includes('name') || key.includes('email')) {
    return 'profile';
  }
  if (key.includes('dashboard') || key.includes('job') || key.includes('work')) {
    return 'dashboard';
  }
  if (key.includes('payment') || key.includes('wallet') || key.includes('amount')) {
    return 'payment';
  }
  if (key.includes('notification') || key.includes('alert')) {
    return 'notification';
  }
  if (key.includes('language') || key.includes('choose')) {
    return 'language';
  }
  if (key.includes('review') || key.includes('rating')) {
    return 'review';
  }
  if (key.includes('booking') || key.includes('service')) {
    return 'booking';
  }
  return 'general';
}

async function importARBFiles() {
  let connection;
  
  try {
    console.log('🔌 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database\n');

    // Statistics
    let totalImported = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    // Process each language
    for (const [langCode, arbPath] of Object.entries(ARB_FILES)) {
      console.log(`\n📝 Processing ${langCode.toUpperCase()}...`);
      
      const fullPath = path.join(__dirname, arbPath);
      
      // Check if file exists
      if (!fs.existsSync(fullPath)) {
        console.log(`⚠️  File not found: ${fullPath}`);
        continue;
      }

      // Read and parse ARB file
      const arbContent = fs.readFileSync(fullPath, 'utf8');
      const arbData = JSON.parse(arbContent);

      let imported = 0;
      let skipped = 0;

      // Import each translation
      for (const [key, value] of Object.entries(arbData)) {
        // Skip metadata keys (start with @)
        if (key.startsWith('@')) {
          continue;
        }

        // Skip empty values
        if (!value || typeof value !== 'string') {
          skipped++;
          continue;
        }

        try {
          const category = getCategoryFromKey(key);
          
          // Insert or update translation
          await connection.execute(
            `INSERT INTO translations (language_code, translation_key, translation_value, category)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE 
               translation_value = VALUES(translation_value),
               category = VALUES(category),
               updated_at = CURRENT_TIMESTAMP`,
            [langCode, key, value, category]
          );
          
          imported++;
        } catch (error) {
          console.error(`❌ Error importing key "${key}":`, error.message);
          totalErrors++;
        }
      }

      console.log(`   ✅ Imported: ${imported} translations`);
      if (skipped > 0) {
        console.log(`   ⏭️  Skipped: ${skipped} entries`);
      }

      totalImported += imported;
      totalSkipped += skipped;
    }

    // Update translation versions
    console.log('\n📦 Updating translation versions...');
    for (const langCode of Object.keys(ARB_FILES)) {
      await connection.execute(
        `INSERT INTO translation_versions (language_code, version, change_summary)
         VALUES (?, '1.0.0', 'Imported from ARB files')
         ON DUPLICATE KEY UPDATE 
           version = '1.0.0',
           change_summary = 'Re-imported from ARB files',
           updated_at = CURRENT_TIMESTAMP`,
        [langCode]
      );
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 IMPORT SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Total Imported: ${totalImported}`);
    console.log(`⏭️  Total Skipped: ${totalSkipped}`);
    console.log(`❌ Total Errors: ${totalErrors}`);
    console.log('='.repeat(50));

    // Show statistics per language
    console.log('\n📈 Translations per language:');
    const [stats] = await connection.execute(
      `SELECT language_code, COUNT(*) as count 
       FROM translations 
       GROUP BY language_code 
       ORDER BY language_code`
    );
    
    stats.forEach(row => {
      console.log(`   ${row.language_code.toUpperCase()}: ${row.count} translations`);
    });

    console.log('\n✅ Import completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed\n');
    }
  }
}

// Run import
console.log('🚀 Starting ARB to Database Import...\n');
importARBFiles();
