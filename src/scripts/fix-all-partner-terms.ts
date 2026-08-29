/**
 * Comprehensive Partner Terminology Fix
 * 
 * Fixes ALL partner-related translations that incorrectly use:
 * - જીવનસાથી (jivansathi - life partner) in Gujarati
 * - સાથી (saathi - companion) in Gujarati/Punjabi
 * - भागीदार (bhagidar - shareholder) in Marathi
 * 
 * Replaces with proper transliteration: પાર્ટનર, पार्टनर, ਪਾਰਟਨਰ
 */

import 'dotenv/config';
import { query } from '../lib/db.js';

// Correct partner transliterations
const PARTNER_WORD = {
  en: 'Partner',
  hi: 'पार्टनर',
  gu: 'પાર્ટનર',
  mr: 'पार्टनर',
  pa: 'ਪਾਰਟਨਰ'
};

// Mapping of incorrect keys to correct translations
const GUJARATI_FIXES: Record<string, string> = {
  firstBookingOffer: 'પાર્ટનર શોધી રહ્યા છીએ...',
  payDoneViaUPI: 'તમારા પાર્ટનર રસ્તામાં છે',
  selectDate: 'તમારા વિસ્તારમાં શ્રેષ્ઠ પાર્ટનરની શોધ કરી રહ્યા છીએ',
  submitReview: 'જ્યારે પાર્ટનર આવે ત્યારે તેમને આ બતાવો',
  yourPaymentOfHasBeenCompleted: 'તમારું બુકિંગ કન્ફર્મ થઈ ગયું છે. અમે તમારા માટે શ્રેષ્ઠ પાર્ટનર શોધી રહ્યા છીએ.',
};

const MARATHI_FIXES: Record<string, string> = {
  firstBookingOffer: 'पार्टनर शोधत आहे...',
  paymentCancelled: 'पार्टनरचा फोन नंबर उपलब्ध नाही',
  yourPaymentOfHasBeenCompleted: 'तुमचे बुकिंग कन्फर्म झाले आहे. आम्ही तुमच्यासाठी सर्वोत्तम पार्टनर शोधत आहोत.',
};

const PUNJABI_FIXES: Record<string, string> = {
  newLabel: 'ਪਾਰਟਨਰ',
  accountInformation: 'ਨਵਾਂ ਪਾਰਟਨਰ',
  pending: 'ਪਾਰਟਨਰ ਸਥਿਤੀ',
  newRating: 'ਸਵਾਗਤ ਹੈ ਪਾਰਟਨਰ!',
  cancelBooking: 'ਪਾਰਟਨਰ ਨੂੰ ਕਾਲ ਕਰੋ',
  claimNow: 'ਪਾਰਟਨਰ ਨਾਲ ਚੈਟ ਕਰੋ',
  firstBookingOffer: 'ਪਾਰਟਨਰ ਲੱਭ ਰਿਹਾ ਹੈ...',
  pay: 'ਪਾਰਟਨਰ ਤੁਹਾਡੀ ਸੇਵਾ \'ਤੇ ਕੰਮ ਕਰ ਰਿਹਾ ਹੈ',
  payDoneViaUPI: 'ਤੁਹਾਡਾ ਪਾਰਟਨਰ ਰਸਤੇ ਵਿੱਚ ਹੈ',
  paymentCancelled: 'ਪਾਰਟਨਰ ਦਾ ਫ਼ੋਨ ਨੰਬਰ ਉਪਲਬਧ ਨਹੀਂ ਹੈ',
  selectDate: 'ਤੁਹਾਡੇ ਖੇਤਰ ਵਿੱਚ ਸਭ ਤੋਂ ਵਧੀਆ ਪਾਰਟਨਰ ਦੀ ਖੋਜ ਕਰ ਰਿਹਾ ਹੈ',
  submitReview: 'ਜਦੋਂ ਪਾਰਟਨਰ ਪਹੁੰਚੇ ਤਾਂ ਇਹ ਉਨ੍ਹਾਂ ਨੂੰ ਦਿਖਾਓ',
  yourPaymentOfHasBeenCompleted: 'ਤੁਹਾਡੀ ਬੁਕਿੰਗ ਦੀ ਪੁਸ਼ਟੀ ਹੋ ਗਈ ਹੈ। ਅਸੀਂ ਤੁਹਾਡੇ ਲਈ ਸਭ ਤੋਂ ਵਧੀਆ ਪਾਰਟਨਰ ਲੱਭ ਰਹੇ ਹਾਂ।',
};

async function fixAllPartnerTerms() {
  console.log('🔧 Comprehensive Partner Terminology Fix\n');
  
  let totalFixed = 0;

  // Fix Gujarati
  console.log('📝 Fixing Gujarati translations...');
  for (const [key, value] of Object.entries(GUJARATI_FIXES)) {
    try {
      await query(
        `UPDATE translations 
         SET translation_value = ?, updated_at = NOW()
         WHERE language_code = 'gu' AND translation_key = ?`,
        [value, key]
      );
      console.log(`   ✅ ${key}`);
      totalFixed++;
    } catch (error) {
      console.error(`   ❌ Error updating ${key}:`, error);
    }
  }

  // Fix Marathi
  console.log('\n📝 Fixing Marathi translations...');
  for (const [key, value] of Object.entries(MARATHI_FIXES)) {
    try {
      await query(
        `UPDATE translations 
         SET translation_value = ?, updated_at = NOW()
         WHERE language_code = 'mr' AND translation_key = ?`,
        [value, key]
      );
      console.log(`   ✅ ${key}`);
      totalFixed++;
    } catch (error) {
      console.error(`   ❌ Error updating ${key}:`, error);
    }
  }

  // Fix Punjabi
  console.log('\n📝 Fixing Punjabi translations...');
  for (const [key, value] of Object.entries(PUNJABI_FIXES)) {
    try {
      await query(
        `UPDATE translations 
         SET translation_value = ?, updated_at = NOW()
         WHERE language_code = 'pa' AND translation_key = ?`,
        [value, key]
      );
      console.log(`   ✅ ${key}`);
      totalFixed++;
    } catch (error) {
      console.error(`   ❌ Error updating ${key}:`, error);
    }
  }

  // Update versions
  console.log('\n🔄 Updating translation versions...');
  const version = new Date().toISOString().split('T')[0].replace(/-/g, '.');
  
  for (const lang of ['gu', 'mr', 'pa']) {
    await query(
      `INSERT INTO translation_versions (language_code, version, updated_at)
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         version = VALUES(version),
         updated_at = NOW()`,
      [lang, version]
    );
  }
  console.log('✅ Versions updated');

  console.log(`\n🎉 Complete! Fixed ${totalFixed} translations`);
  console.log('💡 Tip: Clear app cache to force reload from backend\n');

  // Verification
  console.log('📊 Verification - Sample Translations:');
  const sampleKeys = ['firstBookingOffer', 'submitReview', 'yourPaymentOfHasBeenCompleted'];
  
  for (const key of sampleKeys) {
    const rows: any = await query(
      'SELECT language_code, translation_value FROM translations WHERE translation_key = ? AND language_code IN (?, ?, ?) ORDER BY language_code',
      [key, 'gu', 'mr', 'pa']
    );
    
    console.log(`\n   ${key}:`);
    for (const row of rows) {
      console.log(`      [${row.language_code}]: ${row.translation_value}`);
    }
  }

  process.exit(0);
}

fixAllPartnerTerms().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
