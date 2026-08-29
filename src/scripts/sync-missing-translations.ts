/**
 * Sync Missing Translations Script
 * 
 * Adds all missing translations for Gujarati (gu), Marathi (mr), and Punjabi (pa)
 * by translating from English using Google Translate API
 */

import mysql from 'mysql2/promise';
import { translateAllKeysAtOnce } from '../lib/translate.js';

// Database configuration
const DB_CONFIG = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'workwala',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

interface TranslationKey {
  key: string;
  value: string;
  category: string;
}

/**
 * Get all missing translations for a specific language
 */
async function getMissingTranslations(
  pool: mysql.Pool,
  targetLanguage: string
): Promise<TranslationKey[]> {
  const query = `
    SELECT 
      t1.translation_key as 'key',
      t1.translation_value as 'value',
      t1.category
    FROM translations t1
    WHERE t1.language_code = 'en'
    AND NOT EXISTS (
      SELECT 1 FROM translations t2 
      WHERE t2.language_code = ? 
      AND t2.translation_key = t1.translation_key
    )
    ORDER BY t1.translation_key
  `;

  const [rows] = await pool.query(query, [targetLanguage]);
  return rows as TranslationKey[];
}

/**
 * Insert translations into database
 */
async function insertTranslations(
  pool: mysql.Pool,
  languageCode: string,
  keys: TranslationKey[],
  translations: Map<string, string>
): Promise<void> {
  console.log(`💾 Inserting ${keys.length} translations for ${languageCode}...`);

  // Build batch insert query
  const values: any[] = [];
  const placeholders: string[] = [];

  keys.forEach((item) => {
    const translatedValue = translations.get(item.key) || item.value;
    placeholders.push('(?, ?, ?, ?)');
    values.push(languageCode, item.key, translatedValue, item.category);
  });

  const query = `
    INSERT INTO translations (language_code, translation_key, translation_value, category)
    VALUES ${placeholders.join(', ')}
    ON DUPLICATE KEY UPDATE
      translation_value = VALUES(translation_value),
      category = VALUES(category),
      updated_at = NOW()
  `;

  await pool.query(query, values);
  console.log(`✅ Successfully inserted ${keys.length} translations for ${languageCode}`);
}

/**
 * Main function to sync all missing translations
 */
async function syncMissingTranslations() {
  const pool = mysql.createPool(DB_CONFIG);
  
  try {
    console.log('🚀 Starting translation sync...\n');
    
    const languages = ['gu', 'mr', 'pa'];
    const languageNames: Record<string, string> = {
      'gu': 'Gujarati',
      'mr': 'Marathi',
      'pa': 'Punjabi'
    };

    for (const lang of languages) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🌐 Processing ${languageNames[lang]} (${lang})`);
      console.log(`${'='.repeat(60)}\n`);

      // Get missing translations
      console.log(`📋 Fetching missing translations...`);
      const missingKeys = await getMissingTranslations(pool, lang);
      
      if (missingKeys.length === 0) {
        console.log(`✅ No missing translations for ${languageNames[lang]}!`);
        continue;
      }

      console.log(`📊 Found ${missingKeys.length} missing translations\n`);

      // Translate all keys
      const translations = await translateAllKeysAtOnce(
        missingKeys,
        lang,
        (current, total) => {
          console.log(`   Progress: ${current}/${total} keys processed`);
        }
      );

      // Insert into database
      await insertTranslations(pool, lang, missingKeys, translations);

      // Verify count
      const [result] = await pool.query(
        'SELECT COUNT(*) as count FROM translations WHERE language_code = ?',
        [lang]
      );
      const count = (result as any)[0].count;
      console.log(`✅ Total translations for ${languageNames[lang]}: ${count}`);
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎉 Translation sync completed successfully!`);
    console.log(`${'='.repeat(60)}\n`);

    // Show final counts
    console.log('📊 Final translation counts:');
    const [counts] = await pool.query(`
      SELECT language_code, COUNT(*) as total 
      FROM translations 
      GROUP BY language_code 
      ORDER BY language_code
    `);
    console.table(counts);

  } catch (error) {
    console.error('❌ Error syncing translations:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the script
syncMissingTranslations()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
