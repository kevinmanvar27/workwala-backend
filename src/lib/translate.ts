/**
 * Translation Utility
 * 
 * Provides functions to auto-translate ARB file keys using Google Translate
 * Uses SINGLE REQUEST approach for fast translation
 */

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
 * Read English ARB file(s) and extract all translation keys.
 * Merges both Partner and Customer ARB files — Partner values take priority for shared keys.
 */
export async function getEnglishTranslationKeys(): Promise<TranslationKey[]> {
  const arbPaths = [
    path.join(process.cwd(), '../Work-Wala-Partner/lib/l10n/app_en.arb'),
    path.join(process.cwd(), '../Work-Wala-Customer/lib/l10n/app_en.arb'),
  ];

  // Track category per-file so metadata keys don't bleed across files
  const mergedKeys = new Map<string, TranslationKey>();

  for (const arbFilePath of arbPaths) {
    if (!fs.existsSync(arbFilePath)) {
      console.warn(`⚠️ ARB file not found, skipping: ${arbFilePath}`);
      continue;
    }

    try {
      const fileContent = fs.readFileSync(arbFilePath, 'utf-8');
      const arbData = JSON.parse(fileContent);
      let currentCategory = 'general';

      for (const [key, value] of Object.entries(arbData)) {
        // Skip metadata keys
        if (key.startsWith('@@') || key.startsWith('@')) {
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

        // Only add if not already present (Partner takes priority)
        if (typeof value === 'string' && value.trim() && !mergedKeys.has(key)) {
          mergedKeys.set(key, { key, value, category: currentCategory });
        }
      }

      console.log(`✅ Read ${arbFilePath.split('/').pop()}: ${Object.keys(arbData).filter(k => !k.startsWith('@')).length} keys`);
    } catch (error) {
      console.error(`❌ Error reading ARB file ${arbFilePath}:`, error);
    }
  }

  const keys = Array.from(mergedKeys.values());
  console.log(`✅ Total merged translation keys: ${keys.length}`);
  return keys;
}

/**
 * Translate a single text using MyMemory API (100% free, works on all servers, no API key needed)
 * Free tier: 10,000 words/day
 */
async function translateViaMyMemory(text: string, targetLang: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const encodedText = encodeURIComponent(text);
    // MyMemory uses "en|hi" format for language pair
    const langPair = `en|${targetLang}`;
    const url = `https://api.mymemory.translated.net/get?q=${encodedText}&langpair=${langPair}`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            reject(new Error(`MyMemory HTTP ${res.statusCode}: ${data}`));
            return;
          }
          const parsed = JSON.parse(data);
          // responseStatus 200 means success
          if (parsed?.responseStatus === 200 && parsed?.responseData?.translatedText) {
            resolve(parsed.responseData.translatedText);
          } else {
            reject(new Error(`MyMemory error: ${parsed?.responseDetails || 'Unknown error'}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

/**
 * Translate a single text using Google Translate free endpoint (works locally, may be blocked on servers)
 */
async function translateViaGoogle(text: string, targetLang: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const encodedText = encodeURIComponent(text);
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodedText}`;

    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      }
    };

    https.get(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            reject(new Error(`Google HTTP ${res.statusCode}`));
            return;
          }
          const parsed = JSON.parse(data);
          if (parsed && parsed[0]) {
            const translated = parsed[0].map((item: any) => item[0]).filter(Boolean).join('');
            resolve(translated);
          } else {
            reject(new Error('Invalid Google response format'));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

/**
 * Internal: Translate text with automatic fallback:
 * 1. MyMemory API (free, works on all servers)
 * 2. Google Translate free endpoint (fallback, works locally)
 */
async function doTranslate(text: string, targetLang: string): Promise<string> {
  // Try MyMemory first — free, no key, works on live servers
  try {
    const result = await translateViaMyMemory(text, targetLang);
    console.log(`✅ MyMemory translation successful`);
    return result;
  } catch (error) {
    console.warn(`⚠️ MyMemory failed: ${error instanceof Error ? error.message : error}. Trying Google...`);
  }

  // Fallback to Google free endpoint (works locally)
  const result = await translateViaGoogle(text, targetLang);
  console.log(`✅ Google translation successful`);
  return result;
}

/**
 * Translate ALL keys by batching into small chunks (MyMemory has a 500 char limit per request)
 */
export async function translateAllKeysAtOnce(
  keys: TranslationKey[],
  targetLanguage: string,
  onProgress?: (current: number, total: number) => void
): Promise<Map<string, string>> {
  const translations = new Map<string, string>();
  const targetLang = LANGUAGE_CODE_MAP[targetLanguage] || targetLanguage;

  console.log(`🌐 Starting translation of ${keys.length} keys to ${targetLanguage}...`);

  // MyMemory has a ~500 char limit per request, so we batch keys into chunks
  const CHUNK_SIZE = 5; // translate 5 keys at a time joined by newline
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < keys.length; i += CHUNK_SIZE) {
    const chunk = keys.slice(i, i + CHUNK_SIZE);
    const combinedText = chunk.map(k => k.value).join('\n');

    try {
      const result = await doTranslate(combinedText, targetLang);
      const translatedLines = result.split('\n');

      chunk.forEach((item, idx) => {
        const translated = translatedLines[idx]?.trim();
        if (translated) {
          translations.set(item.key, translated);
          successCount++;
        } else {
          // Fallback to original English value
          translations.set(item.key, item.value);
          failCount++;
        }
      });
    } catch (error) {
      console.error(`❌ Chunk ${i}-${i + CHUNK_SIZE} failed:`, error instanceof Error ? error.message : error);
      // Fallback: keep original English values for this chunk
      chunk.forEach(item => {
        translations.set(item.key, item.value);
        failCount++;
      });
    }

    // Small delay between chunks to avoid rate limiting
    if (i + CHUNK_SIZE < keys.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    if (onProgress) {
      onProgress(Math.min(i + CHUNK_SIZE, keys.length), keys.length);
    }

    // Log progress every 50 keys
    if ((i + CHUNK_SIZE) % 50 === 0 || i + CHUNK_SIZE >= keys.length) {
      console.log(`📊 Progress: ${Math.min(i + CHUNK_SIZE, keys.length)}/${keys.length} keys`);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ Translation completed!`);
  console.log(`   Total: ${translations.size} | Success: ${successCount} | Fallback: ${failCount}`);
  console.log(`${'='.repeat(60)}\n`);

  return translations;
}

/**
 * Translate a single text string to a target language.
 * Used by the test endpoint and migration scripts.
 */
export async function translateText(text: string, targetLanguage: string): Promise<string> {
  const targetLang = LANGUAGE_CODE_MAP[targetLanguage] || targetLanguage;
  return doTranslate(text, targetLang);
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
