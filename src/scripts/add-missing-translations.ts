/**
 * Add Missing Translations to All Languages
 * 
 * This script adds the 9 new translation keys to Gujarati, Marathi, and Punjabi
 * using Google Translate API
 */

import 'dotenv/config';
import { translateText } from '../lib/translate.js';
import { query } from '../lib/db.js';

// New keys that need to be translated
const newKeys = [
  { key: 'bookingNumber', en: 'Booking #{bookingId}' },
  { key: 'bookingIdLabel', en: 'ID: {bookingId}' },
  { key: 'failed', en: 'Failed' },
  { key: 'fullNameRequired', en: 'Full Name *' },
  { key: 'emailOptionalLabel', en: 'Email (Optional)' },
  { key: 'phoneNumberLabel', en: 'Phone Number' },
  { key: 'nameIsRequired', en: 'Name is required' },
  { key: 'phoneNumberHint', en: '9876543210' },
  { key: 'failedToLoadLanguages', en: 'Failed to load languages' },
];

// Target languages
const targetLanguages = [
  { code: 'gu', name: 'Gujarati' },
  { code: 'mr', name: 'Marathi' },
  { code: 'pa', name: 'Punjabi' },
];

async function main() {
  console.log('🌍 Adding Missing Translations to All Languages...\n');

  for (const lang of targetLanguages) {
    console.log(`\n📝 Translating to ${lang.name} (${lang.code})...`);
    
    for (const item of newKeys) {
      try {
        // Skip phone number hint - it's the same in all languages
        let translatedValue = item.en;
        
        if (item.key !== 'phoneNumberHint') {
          // Translate the text
          translatedValue = await translateText(item.en, lang.code);
          console.log(`  ✓ ${item.key}: "${item.en}" → "${translatedValue}"`);
        } else {
          console.log(`  ✓ ${item.key}: "${item.en}" (no translation needed)`);
        }

        // Insert into database
        await query(
          `INSERT INTO translations (language_code, translation_key, translation_value, category)
           VALUES (?, ?, ?, 'general')
           ON DUPLICATE KEY UPDATE translation_value = VALUES(translation_value)`,
          [lang.code, item.key, translatedValue]
        );

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`  ✗ Error translating ${item.key}:`, error);
      }
    }
  }

  // Verify counts
  console.log('\n\n📊 Final Translation Counts:');
  const counts = await query<any[]>(
    'SELECT language_code, COUNT(*) as total FROM translations GROUP BY language_code ORDER BY language_code'
  );
  
  for (const row of counts) {
    console.log(`  ${row.language_code}: ${row.total} translations`);
  }

  console.log('\n✅ All translations added successfully!');
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
