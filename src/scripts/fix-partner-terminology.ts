/**
 * Fix Partner Terminology in Database
 * 
 * Updates all partner-related translations to use the transliterated "Partner" word
 * instead of local language equivalents (like સાથી, साथी, etc.)
 */

import 'dotenv/config';
import { query } from '../lib/db.js';

// Partner-related translation keys that need to be updated
const partnerKeys = [
  'partner',
  'newPartner',
  'partnerStatus',
  'welcomePartner',
  'partnerEnRoute',
  'partnerIsOnTheWay',
  'showThisToYourPartner',
  'partnerPhoneNotAvailable',
  'callPartner',
  'viewPartnerLocation',
  'partnerLocation',
  'findingPartner',
  'searchingForBestPartner',
  'partnerFound',
  'partnerOnTheWay',
  'chatWithPartner',
  'trackPartner',
  'partnerIsWorking',
  'findingNearbyPartner',
  'yourBookingHasBeenConfirmed'
];

// Correct translations for each language
const translations: Record<string, Record<string, string>> = {
  // Gujarati (gu) - પાર્ટનર
  gu: {
    partner: 'પાર્ટનર',
    newPartner: 'નવો પાર્ટનર',
    partnerStatus: 'પાર્ટનર સ્થિતિ',
    welcomePartner: 'સ્વાગત છે પાર્ટનર!',
    partnerEnRoute: 'પાર્ટનર રસ્તામાં છે',
    partnerIsOnTheWay: 'પાર્ટનર રસ્તામાં છે',
    showThisToYourPartner: 'જ્યારે પાર્ટનર આવે ત્યારે તેમને આ બતાવો',
    partnerPhoneNotAvailable: 'પાર્ટનરનો ફોન નંબર ઉપલબ્ધ નથી',
    callPartner: 'પાર્ટનરને કૉલ કરો',
    viewPartnerLocation: 'પાર્ટનરનું સ્થાન જુઓ',
    partnerLocation: 'પાર્ટનરનું સ્થાન',
    findingPartner: 'પાર્ટનર શોધી રહ્યા છીએ...',
    searchingForBestPartner: 'તમારા વિસ્તારમાં શ્રેષ્ઠ પાર્ટનરની શોધ કરી રહ્યા છીએ',
    partnerFound: 'પાર્ટનર મળ્યો!',
    partnerOnTheWay: 'તમારો પાર્ટનર રસ્તામાં છે',
    chatWithPartner: 'પાર્ટનર સાથે ચેટ કરો',
    trackPartner: 'પાર્ટનરને ટ્રેક કરો',
    partnerIsWorking: 'પાર્ટનર તમારી સેવા પર કામ કરી રહ્યો છે',
    findingNearbyPartner: 'નજીકના પાર્ટનરની શોધ....',
    yourBookingHasBeenConfirmed: 'તમારી બુકિંગની પુષ્ટિ થઈ ગઈ છે. અમે તમારા માટે શ્રેષ્ઠ પાર્ટનર શોધી રહ્યા છીએ.'
  },
  
  // Marathi (mr) - पार्टनर
  mr: {
    partner: 'पार्टनर',
    newPartner: 'नवीन पार्टनर',
    partnerStatus: 'पार्टनर स्थिती',
    welcomePartner: 'स्वागत पार्टनर!',
    partnerEnRoute: 'पार्टनर मार्गावर आहे',
    partnerIsOnTheWay: 'पार्टनर मार्गावर आहे',
    showThisToYourPartner: 'पार्टनर आल्यावर त्यांना हे दाखवा',
    partnerPhoneNotAvailable: 'पार्टनरचा फोन नंबर उपलब्ध नाही',
    callPartner: 'पार्टनरला कॉल करा',
    viewPartnerLocation: 'पार्टनरचे स्थान पहा',
    partnerLocation: 'पार्टनरचे स्थान',
    findingPartner: 'पार्टनर शोधत आहे...',
    searchingForBestPartner: 'तुमच्या क्षेत्रात सर्वोत्तम पार्टनर शोधत आहे',
    partnerFound: 'पार्टनर सापडला!',
    partnerOnTheWay: 'तुमचा पार्टनर मार्गावर आहे',
    chatWithPartner: 'पार्टनरशी चॅट करा',
    trackPartner: 'पार्टनर ट्रॅक करा',
    partnerIsWorking: 'पार्टनर तुमच्या सेवेवर काम करत आहे',
    findingNearbyPartner: 'जवळचा पार्टनर शोधत आहे....',
    yourBookingHasBeenConfirmed: 'तुमच्या बुकिंगची पुष्टी झाली आहे. आम्ही तुमच्यासाठी सर्वोत्तम पार्टनर शोधत आहोत.'
  },
  
  // Punjabi (pa) - ਪਾਰਟਨਰ
  pa: {
    partner: 'ਪਾਰਟਨਰ',
    newPartner: 'ਨਵਾਂ ਪਾਰਟਨਰ',
    partnerStatus: 'ਪਾਰਟਨਰ ਸਥਿਤੀ',
    welcomePartner: 'ਸਵਾਗਤ ਹੈ ਪਾਰਟਨਰ!',
    partnerEnRoute: 'ਪਾਰਟਨਰ ਰਸਤੇ ਵਿੱਚ ਹੈ',
    partnerIsOnTheWay: 'ਪਾਰਟਨਰ ਰਸਤੇ ਵਿੱਚ ਹੈ',
    showThisToYourPartner: 'ਜਦੋਂ ਪਾਰਟਨਰ ਪਹੁੰਚੇ ਤਾਂ ਇਹ ਉਨ੍ਹਾਂ ਨੂੰ ਦਿਖਾਓ',
    partnerPhoneNotAvailable: 'ਪਾਰਟਨਰ ਦਾ ਫ਼ੋਨ ਨੰਬਰ ਉਪਲਬਧ ਨਹੀਂ ਹੈ',
    callPartner: 'ਪਾਰਟਨਰ ਨੂੰ ਕਾਲ ਕਰੋ',
    viewPartnerLocation: 'ਪਾਰਟਨਰ ਦੀ ਸਥਿਤੀ ਦੇਖੋ',
    partnerLocation: 'ਪਾਰਟਨਰ ਦੀ ਸਥਿਤੀ',
    findingPartner: 'ਪਾਰਟਨਰ ਲੱਭ ਰਿਹਾ ਹੈ...',
    searchingForBestPartner: 'ਤੁਹਾਡੇ ਖੇਤਰ ਵਿੱਚ ਸਭ ਤੋਂ ਵਧੀਆ ਪਾਰਟਨਰ ਦੀ ਖੋਜ ਕਰ ਰਿਹਾ ਹੈ',
    partnerFound: 'ਪਾਰਟਨਰ ਮਿਲ ਗਿਆ!',
    partnerOnTheWay: 'ਤੁਹਾਡਾ ਪਾਰਟਨਰ ਰਸਤੇ ਵਿੱਚ ਹੈ',
    chatWithPartner: 'ਪਾਰਟਨਰ ਨਾਲ ਚੈਟ ਕਰੋ',
    trackPartner: 'ਪਾਰਟਨਰ ਨੂੰ ਟਰੈਕ ਕਰੋ',
    partnerIsWorking: 'ਪਾਰਟਨਰ ਤੁਹਾਡੀ ਸੇਵਾ ਤੇ ਕੰਮ ਕਰ ਰਿਹਾ ਹੈ',
    findingNearbyPartner: 'ਨੇੜੇ ਦਾ ਪਾਰਟਨਰ ਲੱਭ ਰਿਹਾ ਹੈ....',
    yourBookingHasBeenConfirmed: 'ਤੁਹਾਡੀ ਬੁਕਿੰਗ ਦੀ ਪੁਸ਼ਟੀ ਹੋ ਗਈ ਹੈ। ਅਸੀਂ ਤੁਹਾਡੇ ਲਈ ਸਭ ਤੋਂ ਵਧੀਆ ਪਾਰਟਨਰ ਲੱਭ ਰਹੇ ਹਾਂ।'
  }
};

async function main() {
  console.log('🔧 Fixing Partner Terminology in Database...\n');

  const languages = ['gu', 'mr', 'pa'];
  let totalUpdated = 0;

  for (const lang of languages) {
    console.log(`📝 Updating ${lang.toUpperCase()} translations...`);
    const langTranslations = translations[lang];
    let count = 0;

    for (const [key, value] of Object.entries(langTranslations)) {
      try {
        await query(
          `UPDATE translations 
           SET translation_value = ?, updated_at = NOW()
           WHERE language_code = ? AND translation_key = ?`,
          [value, lang, key]
        );
        count++;
      } catch (error) {
        console.error(`   ❌ Error updating ${key}:`, error);
      }
    }

    console.log(`   ✅ Updated ${count} translations\n`);
    totalUpdated += count;
  }

  // Update translation versions
  console.log('🔄 Updating translation versions...');
  const version = new Date().toISOString().split('T')[0].replace(/-/g, '.');

  for (const lang of languages) {
    await query(
      `INSERT INTO translation_versions (language_code, version, updated_at)
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         version = VALUES(version),
         updated_at = NOW()`,
      [lang, version]
    );
  }

  console.log(`✅ Updated versions to ${version}\n`);

  console.log(`🎉 Complete! Updated ${totalUpdated} translations across ${languages.length} languages`);
  console.log('💡 Tip: Clear app cache to force reload from backend\n');

  // Verify - show a few examples
  console.log('📊 Verification - Sample Translations:');
  const samples = await query<Array<{translation_key: string, language_code: string, translation_value: string}>>(
    `SELECT translation_key, language_code, translation_value 
     FROM translations 
     WHERE translation_key IN ('partner', 'callPartner', 'welcomePartner')
     AND language_code IN ('gu', 'mr', 'pa')
     ORDER BY translation_key, language_code`
  );

  samples.forEach(row => {
    console.log(`   ${row.translation_key} [${row.language_code}]: ${row.translation_value}`);
  });

  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
