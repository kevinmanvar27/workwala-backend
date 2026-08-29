import mysql from 'mysql2/promise';

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'workwala'
};

// Correct transliterations for reference
const CORRECT_PARTNER_TERMS = {
  en: 'Partner',
  hi: 'पार्टनर',
  gu: 'પાર્ટનર',
  mr: 'पार्टनर',
  pa: 'ਪਾਰਟਨਰ'
};

// Incorrect terms that should NOT appear
const INCORRECT_TERMS = {
  gu: ['સાથી', 'જીવનસાથી', 'કામદાર'],
  hi: ['साथी'],
  mr: ['भागीदार', 'साथी'],
  pa: ['ਸਾਥੀ', 'ਭਾਗੀਦਾਰ']
};

async function comprehensivePartnerTest() {
  console.log('🔍 COMPREHENSIVE PARTNER TERMINOLOGY TEST\n');
  console.log('=' .repeat(80) + '\n');

  const connection = await mysql.createConnection(dbConfig);

  try {
    // Test 1: Check all partner-related keys in database
    console.log('📊 TEST 1: Database Partner Keys\n');
    
    const [rows] = await connection.execute<any[]>(
      `SELECT translation_key, language_code, translation_value 
       FROM translations 
       WHERE translation_key LIKE '%partner%' 
       ORDER BY translation_key, language_code`
    );

    const keyGroups = new Map<string, Map<string, string>>();
    
    for (const row of rows) {
      if (!keyGroups.has(row.translation_key)) {
        keyGroups.set(row.translation_key, new Map());
      }
      keyGroups.get(row.translation_key)!.set(row.language_code, row.translation_value);
    }

    let dbTestsPassed = 0;
    let dbTestsFailed = 0;

    for (const [key, translations] of keyGroups) {
      console.log(`📌 ${key}:`);
      
      for (const [lang, value] of translations) {
        // Check if value contains incorrect terms
        let hasError = false;
        const incorrectTermsForLang = INCORRECT_TERMS[lang as keyof typeof INCORRECT_TERMS] || [];
        
        for (const incorrectTerm of incorrectTermsForLang) {
          if (value.includes(incorrectTerm)) {
            console.log(`   ❌ [${lang}] Contains incorrect term "${incorrectTerm}": ${value}`);
            hasError = true;
            dbTestsFailed++;
          }
        }
        
        if (!hasError) {
          console.log(`   ✅ [${lang}] ${value}`);
          dbTestsPassed++;
        }
      }
      console.log();
    }

    console.log(`Database Tests: ${dbTestsPassed} passed, ${dbTestsFailed} failed\n`);
    console.log('=' .repeat(80) + '\n');

    // Test 2: Check for any remaining incorrect terms in entire database
    console.log('📊 TEST 2: Scan Entire Database for Incorrect Terms\n');

    const incorrectFindings: Array<{lang: string, key: string, value: string, term: string}> = [];

    for (const [lang, terms] of Object.entries(INCORRECT_TERMS)) {
      for (const term of terms) {
        const [findings] = await connection.execute<any[]>(
          `SELECT translation_key, translation_value 
           FROM translations 
           WHERE language_code = ? AND translation_value LIKE ?`,
          [lang, `%${term}%`]
        );

        for (const finding of findings) {
          incorrectFindings.push({
            lang,
            key: finding.translation_key,
            value: finding.translation_value,
            term
          });
        }
      }
    }

    if (incorrectFindings.length === 0) {
      console.log('✅ No incorrect terms found in database!\n');
    } else {
      console.log(`❌ Found ${incorrectFindings.length} entries with incorrect terms:\n`);
      for (const finding of incorrectFindings) {
        console.log(`   [${finding.lang}] ${finding.key}: "${finding.value}"`);
        console.log(`   Contains: "${finding.term}"\n`);
      }
    }

    console.log('=' .repeat(80) + '\n');

    // Test 3: Verify core partner keys exist and are correct
    console.log('📊 TEST 3: Core Partner Keys Verification\n');

    const coreKeys = [
      'partner',
      'newPartner',
      'partnerStatus',
      'welcomePartner',
      'partnerEnRoute'
    ];

    let coreTestsPassed = 0;
    let coreTestsFailed = 0;

    for (const key of coreKeys) {
      console.log(`📌 ${key}:`);
      
      for (const lang of ['en', 'hi', 'gu', 'mr', 'pa']) {
        const [result] = await connection.execute<any[]>(
          'SELECT translation_value FROM translations WHERE translation_key = ? AND language_code = ?',
          [key, lang]
        );

        if (result.length === 0) {
          console.log(`   ⚠️  [${lang}] Missing translation`);
          coreTestsFailed++;
        } else {
          const value = result[0].translation_value;
          const correctTerm = CORRECT_PARTNER_TERMS[lang as keyof typeof CORRECT_PARTNER_TERMS];
          
          if (value.includes(correctTerm)) {
            console.log(`   ✅ [${lang}] ${value}`);
            coreTestsPassed++;
          } else {
            console.log(`   ❌ [${lang}] ${value} (should contain "${correctTerm}")`);
            coreTestsFailed++;
          }
        }
      }
      console.log();
    }

    console.log(`Core Keys Tests: ${coreTestsPassed} passed, ${coreTestsFailed} failed\n`);
    console.log('=' .repeat(80) + '\n');

    // Final Summary
    console.log('📊 FINAL SUMMARY\n');
    
    const totalTests = dbTestsPassed + dbTestsFailed + coreTestsPassed + coreTestsFailed;
    const totalPassed = dbTestsPassed + coreTestsPassed;
    const totalFailed = dbTestsFailed + coreTestsFailed + incorrectFindings.length;

    console.log(`Total Tests: ${totalTests}`);
    console.log(`✅ Passed: ${totalPassed}`);
    console.log(`❌ Failed: ${totalFailed}`);
    console.log(`🔍 Incorrect Terms Found: ${incorrectFindings.length}\n`);

    if (totalFailed === 0 && incorrectFindings.length === 0) {
      console.log('🎉 SUCCESS! All partner terminology is correct across the entire database!\n');
      console.log('✅ Database is ready for production use.\n');
      console.log('💡 Next Steps:');
      console.log('   1. Restart Flutter apps to load new translations');
      console.log('   2. Test in-app to verify UI displays correct terms');
      console.log('   3. Check drawer navigation and all partner references\n');
    } else {
      console.log('⚠️  ISSUES FOUND! Please review the failed tests above.\n');
    }

  } catch (error) {
    console.error('❌ Error during testing:', error);
  } finally {
    await connection.end();
  }
}

comprehensivePartnerTest();
