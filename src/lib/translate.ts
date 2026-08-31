/**
 * Translation Utility
 * 
 * Provides functions to auto-translate ARB file keys using Google Translate
 * Uses SINGLE REQUEST approach for fast translation
 */

import { translate as googleTranslate } from '@vitalets/google-translate-api';
import fs from 'fs';
import path from 'path';
import https from 'https';

// Language code mapping for Google Translate
const LANGUAGE_CODE_MAP: Record<string, string> = {
  'en': 'en',
  'hi': 'hi',
  'gu': 'gu',
  'mr': 'mr',
  'pa': 'pa',
  'es': 'es',
  'fr': 'fr',
  'de': 'de',
  'it': 'it',
  'pt': 'pt',
  'ru': 'ru',
  'ja': 'ja',
  'ko': 'ko',
  'zh': 'zh-CN',
  'ar': 'ar',
  'bn': 'bn',
  'ta': 'ta',
  'te': 'te',
  'ml': 'ml',
  'kn': 'kn',
};

interface TranslationKey {
  key: string;
  value: string;
  category: string;
}

/**
 * Read English ARB file and extract all translation keys
 */
export async function getEnglishTranslationKeys(): Promise<TranslationKey[]> {
  const arbFilePath = path.join(
    process.cwd(),
    '../Work-Wala-Partner/lib/l10n/app_en.arb'
  );

  try {
    const fileContent = fs.readFileSync(arbFilePath, 'utf-8');
    const arbData = JSON.parse(fileContent);
    
    const keys: TranslationKey[] = [];
    let currentCategory = 'general';

    for (const [key, value] of Object.entries(arbData)) {
      // Skip metadata keys
      if (key.startsWith('@@') || key.startsWith('@')) {
        // Extract category from comment keys like "@@ Auth Screens @@"
        if (key.startsWith('@@') && typeof value === 'string') {
          const categoryMatch = value || key.replace(/@@/g, '').trim();
          if (categoryMatch) {
            currentCategory = categoryMatch.toLowerCase()
              .replace(/[^a-z0-9]+/g, '_')
              .replace(/^_|_$/g, '') || 'general';
          }
        }
        continue;
      }

      // Add translation key
      if (typeof value === 'string' && value.trim()) {
        keys.push({
          key,
          value,
          category: currentCategory,
        });
      }
    }

    console.log(`✅ Extracted ${keys.length} translation keys from ARB file`);
    return keys;

  } catch (error) {
    console.error('❌ Error reading ARB file:', error);
    throw new Error('Failed to read English ARB file');
  }
}

/**
 * Translate using Google Translate API directly (more reliable for large requests)
 */
async function translateViaDirect(text: string, targetLang: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const encodedText = encodeURIComponent(text);
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodedText}`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed && parsed[0]) {
            const translated = parsed[0].map((item: any) => item[0]).join('');
            resolve(translated);
          } else {
            reject(new Error('Invalid response format'));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

/**
 * Translate ALL keys in a SINGLE request
 * Fast and efficient - completes in seconds instead of minutes
 */
export async function translateAllKeysAtOnce(
  keys: TranslationKey[],
  targetLanguage: string,
  onProgress?: (current: number, total: number) => void
): Promise<Map<string, string>> {
  const translations = new Map<string, string>();
  const targetLang = LANGUAGE_CODE_MAP[targetLanguage] || targetLanguage;
  
  console.log(`🌐 Starting SINGLE-REQUEST translation of ${keys.length} keys to ${targetLanguage}...`);
  console.log(`⚡ This should complete in under 10 seconds!\n`);

  try {
    // Create JSON array of all texts to translate
    const textsToTranslate = keys.map(k => k.value);
    
    // Use newline as delimiter (more reliable than custom delimiter)
    const combinedText = textsToTranslate.join('\n');
    
    console.log(`📝 Translating ${keys.length} keys (${combinedText.length} characters)...`);
    console.log(`🔄 Sending single translation request...`);
    
    // Single translation request
    const result = await translateViaDirect(combinedText, targetLang);
    
    if (!result) {
      throw new Error('Empty translation result');
    }
    
    console.log(`✅ Translation received! (${result.length} characters)`);
    
    // Split back into individual translations
    const translatedTexts = result.split('\n');
    
    console.log(`📊 Split into ${translatedTexts.length} translations (expected ${keys.length})\n`);
    
    // Map translations back to keys
    let successCount = 0;
    let failCount = 0;
    
    keys.forEach((item, index) => {
      if (index < translatedTexts.length) {
        const translated = translatedTexts[index].trim();
        if (translated && translated.length > 0) {
          translations.set(item.key, translated);
          successCount++;
        } else {
          translations.set(item.key, item.value);
          failCount++;
        }
      } else {
        translations.set(item.key, item.value);
        failCount++;
      }
      
      // Report progress
      if (onProgress && (index + 1) % 50 === 0) {
        onProgress(index + 1, keys.length);
      }
    });
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Translation completed in SINGLE request!`);
    console.log(`📊 Final stats:`);
    console.log(`   Total: ${translations.size}`);
    console.log(`   Successful: ${successCount}`);
    console.log(`   Failed: ${failCount}`);
    console.log(`${'='.repeat(60)}\n`);
    
    return translations;
    
  } catch (error) {
    console.error('❌ Single-request translation failed:', error);
    throw error; // Don't fallback - just fail fast
  }
}

/**
 * Translate a single text string to a target language.
 * Used by the test endpoint and migration scripts.
 */
export async function translateText(text: string, targetLanguage: string): Promise<string> {
  const targetLang = LANGUAGE_CODE_MAP[targetLanguage] || targetLanguage;
  return translateViaDirect(text, targetLang);
}

/**
 * Batch insert translations into database
 */
export async function batchInsertTranslations(
  pool: any,
  languageCode: string,
  keys: TranslationKey[],
  translations: Map<string, string>
): Promise<void> {
  try {
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
    console.log(`✅ Successfully inserted/updated ${keys.length} translations`);

  } catch (error) {
    console.error('❌ Error inserting translations:', error);
    throw new Error('Failed to insert translations into database');
  }
}
