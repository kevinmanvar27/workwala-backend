import 'dotenv/config';
import { query } from '../lib/db.js';

/**
 * Find all translations containing incorrect partner terminology
 * Searches for સાથી, જીવનસાથી, કામદાર, etc.
 */

async function findIncorrectTerms() {
  console.log('🔍 Searching for incorrect partner terminology in database...\n');

  const incorrectTerms = [
    'સાથી',        // Gujarati: saathi
    'જીવનસાથી',    // Gujarati: jivansathi
    'કામદાર',      // Gujarati: kamdar
    'साथी',        // Hindi: saathi (but we already fixed Hindi)
    'जीवनसाथी',    // Hindi: jivansathi
    'कामदार',      // Hindi: kamdar
    'साथीदार',     // Hindi: sathidar
    'साझेदार',     // Hindi: sajhedar
    'सहयोगी',      // Hindi: sahyogi
    'भागीदार',     // Marathi: bhagidar (wrong)
    'साथीदार',     // Marathi: sathidar
    'ਸਾਥੀ',        // Punjabi: saathi
    'ਸਾਥੀਦਾਰ',     // Punjabi: sathidar
  ];

  const results: any = {};

  for (const term of incorrectTerms) {
    const rows: any = await query(
      'SELECT translation_key, language_code, translation_value FROM translations WHERE translation_value LIKE ?',
      [`%${term}%`]
    );

    if (rows.length > 0) {
      console.log(`\n❌ Found ${rows.length} entries containing "${term}":`);
      for (const row of rows) {
        console.log(`   [${row.language_code}] ${row.translation_key}: ${row.translation_value}`);
        
        if (!results[row.language_code]) {
          results[row.language_code] = [];
        }
        results[row.language_code].push({
          key: row.translation_key,
          value: row.translation_value,
          term: term
        });
      }
    }
  }

  console.log('\n\n📊 Summary by Language:');
  for (const [lang, entries] of Object.entries(results)) {
    console.log(`\n${lang.toUpperCase()}: ${(entries as any).length} incorrect entries`);
  }

  if (Object.keys(results).length === 0) {
    console.log('\n✅ No incorrect partner terminology found!');
  } else {
    console.log('\n\n💡 Run fix-partner-terminology.ts to correct these entries.');
  }

  process.exit(0);
}

findIncorrectTerms().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
