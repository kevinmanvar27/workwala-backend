/**
 * Translate Customer App to Hindi
 * 
 * Strategy:
 * 1. Read Customer app_en.arb (source)
 * 2. Read Partner app_hi.arb (reuse common translations)
 * 3. Auto-translate missing keys using Google Translate
 * 4. Generate complete app_hi.arb for Customer app
 */

import fs from 'fs';
import path from 'path';
import { translateViaDirect } from '../lib/translate-helper';

const CUSTOMER_EN_PATH = path.join(process.cwd(), '../Work-Wala-Customer/lib/l10n/app_en.arb');
const CUSTOMER_HI_PATH = path.join(process.cwd(), '../Work-Wala-Customer/lib/l10n/app_hi.arb');
const PARTNER_HI_PATH = path.join(process.cwd(), '../Work-Wala-Partner/lib/l10n/app_hi.arb');

interface ARBData {
  [key: string]: any;
}

async function main() {
  console.log('🚀 Starting Customer App Hindi Translation...\n');

  // 1. Read all files
  console.log('📖 Reading ARB files...');
  const customerEnData: ARBData = JSON.parse(fs.readFileSync(CUSTOMER_EN_PATH, 'utf-8'));
  const customerHiData: ARBData = JSON.parse(fs.readFileSync(CUSTOMER_HI_PATH, 'utf-8'));
  const partnerHiData: ARBData = JSON.parse(fs.readFileSync(PARTNER_HI_PATH, 'utf-8'));

  // 2. Extract keys
  const customerEnKeys = Object.keys(customerEnData).filter(k => !k.startsWith('@'));
  const existingHiKeys = Object.keys(customerHiData).filter(k => !k.startsWith('@'));
  const partnerHiKeys = Object.keys(partnerHiData).filter(k => !k.startsWith('@'));

  console.log(`✅ Customer EN keys: ${customerEnKeys.length}`);
  console.log(`✅ Customer HI keys (existing): ${existingHiKeys.length}`);
  console.log(`✅ Partner HI keys: ${partnerHiKeys.length}\n`);

  // 3. Build result object
  const result: ARBData = {
    "@@locale": "hi",
    "@@context": "Customer App - Hindi Translations"
  };

  // Copy existing customer Hindi translations
  for (const key of existingHiKeys) {
    result[key] = customerHiData[key];
    // Also copy metadata if exists
    const metaKey = `@${key}`;
    if (customerHiData[metaKey]) {
      result[metaKey] = customerHiData[metaKey];
    }
  }

  // 4. Find missing keys
  const missingKeys = customerEnKeys.filter(k => !existingHiKeys.includes(k));
  console.log(`🔍 Missing translations: ${missingKeys.length}\n`);

  // 5. Reuse from Partner app where possible
  let reusedCount = 0;
  const stillMissing: string[] = [];

  for (const key of missingKeys) {
    if (partnerHiData[key]) {
      result[key] = partnerHiData[key];
      // Copy metadata too
      const metaKey = `@${key}`;
      if (partnerHiData[metaKey]) {
        result[metaKey] = partnerHiData[metaKey];
      }
      reusedCount++;
    } else {
      stillMissing.push(key);
    }
  }

  console.log(`♻️  Reused from Partner app: ${reusedCount}`);
  console.log(`🔄 Still need translation: ${stillMissing.length}\n`);

  // 6. Auto-translate remaining keys
  if (stillMissing.length > 0) {
    console.log('🌐 Auto-translating remaining keys...\n');
    
    const textsToTranslate = stillMissing.map(key => customerEnData[key]);
    const combinedText = textsToTranslate.join('\n|||DELIMITER|||\n');
    
    console.log(`📝 Translating ${stillMissing.length} keys...`);
    
    try {
      const translated = await translateViaDirect(combinedText, 'hi');
      const translatedTexts = translated.split('\n|||DELIMITER|||\n');
      
      for (let i = 0; i < stillMissing.length; i++) {
        const key = stillMissing[i];
        const translation = translatedTexts[i]?.trim() || customerEnData[key];
        result[key] = translation;
        
        // Copy metadata from English if exists
        const metaKey = `@${key}`;
        if (customerEnData[metaKey]) {
          result[metaKey] = customerEnData[metaKey];
        }
      }
      
      console.log(`✅ Auto-translated ${stillMissing.length} keys\n`);
    } catch (error) {
      console.error('❌ Translation failed:', error);
      console.log('⚠️  Using English fallback for remaining keys\n');
      
      for (const key of stillMissing) {
        result[key] = customerEnData[key];
        const metaKey = `@${key}`;
        if (customerEnData[metaKey]) {
          result[metaKey] = customerEnData[metaKey];
        }
      }
    }
  }

  // 7. Write result
  console.log('💾 Writing updated app_hi.arb...');
  fs.writeFileSync(CUSTOMER_HI_PATH, JSON.stringify(result, null, 2), 'utf-8');
  
  const finalKeys = Object.keys(result).filter(k => !k.startsWith('@'));
  console.log(`✅ Final Hindi translations: ${finalKeys.length}`);
  console.log(`✅ Coverage: ${((finalKeys.length / customerEnKeys.length) * 100).toFixed(1)}%\n`);
  
  console.log('🎉 Translation complete!');
  console.log(`📁 Output: ${CUSTOMER_HI_PATH}`);
}

main().catch(console.error);
