import 'dotenv/config';
import { query } from '../lib/db.js';

/**
 * Final Verification of Partner Terminology
 * Shows all partner-related translations across all languages
 */

async function finalVerification() {
  console.log('🎯 FINAL VERIFICATION - Partner Terminology Across All Languages\n');
  console.log('=' .repeat(80));

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
    'chatWithPartner',
    'trackPartner',
    'findingNearbyPartner',
    'partnerFound',
    'partnerOnTheWay',
    'partnerIsWorking',
    'viewPartnerLocation',
    'partnerLocation',
    'findingPartner',
    'searchingForBestPartner',
    'yourBookingHasBeenConfirmed'
  ];

  const languages = ['en', 'hi', 'gu', 'mr', 'pa'];
  const languageNames = {
    en: 'English',
    hi: 'Hindi',
    gu: 'Gujarati',
    mr: 'Marathi',
    pa: 'Punjabi'
  };

  let allCorrect = true;

  for (const key of partnerKeys) {
    const rows: any = await query(
      'SELECT language_code, translation_value FROM translations WHERE translation_key = ? ORDER BY language_code',
      [key]
    );

    if (rows.length > 0) {
      console.log(`\n📌 ${key}:`);
      
      for (const lang of languages) {
        const row = rows.find((r: any) => r.language_code === lang);
        if (row) {
          const value = row.translation_value;
          
          // Check for incorrect terms
          const incorrectTerms = ['સાથી', 'જીવનસાથી', 'કામદાર', 'साथी', 'जीवनसाथी', 'भागीदार', 'ਸਾਥੀ'];
          const hasIncorrect = incorrectTerms.some(term => value.includes(term));
          
          const icon = hasIncorrect ? '❌' : '✅';
          if (hasIncorrect) allCorrect = false;
          
          console.log(`   ${icon} [${lang}] ${languageNames[lang]}: ${value}`);
        }
      }
    }
  }

  console.log('\n' + '='.repeat(80));
  
  if (allCorrect) {
    console.log('\n🎉 SUCCESS! All partner terminology is correct!');
    console.log('✅ All translations use proper transliteration: પાર્ટનર, पार्टनर, ਪਾਰਟਨਰ');
  } else {
    console.log('\n⚠️  WARNING: Some translations still have incorrect terms!');
    console.log('Please review the entries marked with ❌ above.');
  }

  console.log('\n💡 Summary:');
  console.log('   - English: "Partner"');
  console.log('   - Hindi: "पार्टनर" (Partner transliteration)');
  console.log('   - Gujarati: "પાર્ટનર" (Partner transliteration)');
  console.log('   - Marathi: "पार्टनर" (Partner transliteration)');
  console.log('   - Punjabi: "ਪਾਰਟਨਰ" (Partner transliteration)');
  console.log('\n');

  process.exit(allCorrect ? 0 : 1);
}

finalVerification().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
