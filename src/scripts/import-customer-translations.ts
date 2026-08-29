/**
 * Import Customer App Translations to Database
 * 
 * Reads Customer app ARB files and imports them into the database
 * so the dynamic translation system can serve them
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { query } from '../lib/db.js';

const CUSTOMER_EN_ARB = path.join(process.cwd(), '../Work-Wala-Customer/lib/l10n/app_en.arb');
const CUSTOMER_HI_ARB = path.join(process.cwd(), '../Work-Wala-Customer/lib/l10n/app_hi.arb');

interface ARBData {
  [key: string]: any;
}

async function main() {
  console.log('🚀 Importing Customer App Translations to Database...\n');

  // Read ARB files
  const enData: ARBData = JSON.parse(fs.readFileSync(CUSTOMER_EN_ARB, 'utf-8'));
  const hiData: ARBData = JSON.parse(fs.readFileSync(CUSTOMER_HI_ARB, 'utf-8'));

  // Extract keys (skip metadata keys starting with @)
  const enKeys = Object.keys(enData).filter(k => !k.startsWith('@'));
  const hiKeys = Object.keys(hiData).filter(k => !k.startsWith('@'));

  console.log(`📖 English keys: ${enKeys.length}`);
  console.log(`📖 Hindi keys: ${hiKeys.length}\n`);

  // Check if languages exist in database
  const languages = await query<Array<{code: string, name: string}>>(
    'SELECT code, name FROM languages WHERE code IN (?, ?)',
    ['en', 'hi']
  );

  console.log(`✅ Found ${languages.length} languages in database:`);
  languages.forEach(lang => console.log(`   - ${lang.code}: ${lang.name}`));
  console.log();

  // Import English translations
  console.log('📥 Importing English translations...');
  let enCount = 0;
  for (const key of enKeys) {
    const value = enData[key];
    if (typeof value === 'string') {
      await query(
        `INSERT INTO translations (language_code, translation_key, translation_value, category)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           translation_value = VALUES(translation_value),
           updated_at = NOW()`,
        ['en', key, value, 'customer_app']
      );
      enCount++;
    }
  }
  console.log(`✅ Imported ${enCount} English translations\n`);

  // Import Hindi translations
  console.log('📥 Importing Hindi translations...');
  let hiCount = 0;
  for (const key of hiKeys) {
    const value = hiData[key];
    if (typeof value === 'string') {
      await query(
        `INSERT INTO translations (language_code, translation_key, translation_value, category)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           translation_value = VALUES(translation_value),
           updated_at = NOW()`,
        ['hi', key, value, 'customer_app']
      );
      hiCount++;
    }
  }
  console.log(`✅ Imported ${hiCount} Hindi translations\n`);

  // Update translation versions
  console.log('🔄 Updating translation versions...');
  const version = new Date().toISOString().split('T')[0].replace(/-/g, '.');
  
  await query(
    `INSERT INTO translation_versions (language_code, version, updated_at)
     VALUES (?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       version = VALUES(version),
       updated_at = NOW()`,
    ['en', version]
  );
  
  await query(
    `INSERT INTO translation_versions (language_code, version, updated_at)
     VALUES (?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       version = VALUES(version),
       updated_at = NOW()`,
    ['hi', version]
  );
  
  console.log(`✅ Updated versions to ${version}\n`);

  // Verify
  const enTotal = await query<Array<{count: number}>>(
    'SELECT COUNT(*) as count FROM translations WHERE language_code = ?',
    ['en']
  );
  
  const hiTotal = await query<Array<{count: number}>>(
    'SELECT COUNT(*) as count FROM translations WHERE language_code = ?',
    ['hi']
  );

  console.log('📊 Database Summary:');
  console.log(`   English: ${enTotal[0].count} translations`);
  console.log(`   Hindi: ${hiTotal[0].count} translations\n`);

  console.log('🎉 Import complete!');
  console.log('💡 Tip: Clear app cache to force reload from backend');
  
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
