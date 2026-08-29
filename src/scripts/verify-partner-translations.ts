import 'dotenv/config';
import { query } from '../lib/db.js';

async function verifyPartnerTranslations() {
  console.log('\n🔍 Verifying Partner Terminology Translations...\n');

  const keys = [
    'partner',
    'newPartner',
    'callPartner',
    'welcomePartner',
    'chatWithPartner',
    'trackPartner',
    'partnerEnRoute',
    'partnerIsOnTheWay',
    'showThisToYourPartner'
  ];

  for (const key of keys) {
    console.log(`📌 ${key}:`);
    const rows: any = await query(
      'SELECT language_code, translation_value FROM translations WHERE translation_key = ? ORDER BY language_code',
      [key]
    );
    
    for (const row of rows) {
      console.log(`   [${row.language_code}]: ${row.translation_value}`);
    }
    console.log('');
  }

  console.log('✅ Verification complete!\n');
  process.exit(0);
}

verifyPartnerTranslations().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
