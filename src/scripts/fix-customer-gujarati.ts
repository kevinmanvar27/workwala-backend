import mysql from 'mysql2/promise';

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'workwala'
};

async function fixCustomerGujarati() {
  console.log('🔧 Fixing Customer App Gujarati Translations\n');
  console.log('=' .repeat(80) + '\n');

  const connection = await mysql.createConnection(dbConfig);

  try {
    const fixes = [
      {
        key: 'myBookings',
        oldValue: 'શું તમે ખરેખર લોગઆઉટ કરવા માંગો છો?',
        newValue: 'મારી બુકિંગ્સ',
        reason: 'Was showing logout message instead of "My Bookings"'
      },
      {
        key: 'payments',
        oldValue: 'ચુકવણી ભૂલ',
        newValue: 'ચુકવણીઓ',
        reason: 'Was showing "payment error" instead of "Payments"'
      },
      {
        key: 'claimNow',
        oldValue: 'પાર્ટનર સાથે ચેટ કરો',
        newValue: 'હમણાં ક્લેઇમ કરો',
        reason: 'Was showing "Chat with Partner" instead of "Claim Now"'
      },
      {
        key: 'firstBookingOffer',
        oldValue: 'પાર્ટનર શોધી રહ્યા છીએ...',
        newValue: 'તમારી પ્રથમ બુકિંગ પર\nફ્લેટ ₹100 ની છૂટ',
        reason: 'Was showing "Finding Partner..." instead of offer text'
      }
    ];

    let successCount = 0;
    let failCount = 0;

    for (const fix of fixes) {
      console.log(`📝 Fixing: ${fix.key}`);
      console.log(`   Reason: ${fix.reason}`);
      console.log(`   Old: ${fix.oldValue}`);
      console.log(`   New: ${fix.newValue}`);

      try {
        const [result] = await connection.execute(
          `UPDATE translations 
           SET translation_value = ?, updated_at = NOW() 
           WHERE translation_key = ? AND language_code = 'gu'`,
          [fix.newValue, fix.key]
        );

        if ((result as any).affectedRows > 0) {
          console.log(`   ✅ Updated successfully\n`);
          successCount++;
        } else {
          console.log(`   ⚠️  No rows affected (key might not exist)\n`);
          failCount++;
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error}\n`);
        failCount++;
      }
    }

    // Update database version
    await connection.execute(
      `UPDATE translations 
       SET translation_value = '2026.08.29.2', updated_at = NOW() 
       WHERE translation_key = 'databaseVersion' AND language_code = 'en'`
    );

    console.log('=' .repeat(80));
    console.log(`\n✅ Fixed: ${successCount} translations`);
    console.log(`❌ Failed: ${failCount} translations\n`);

    // Verify the fixes
    console.log('🔍 Verifying fixes...\n');
    
    for (const fix of fixes) {
      const [rows] = await connection.execute<any[]>(
        `SELECT translation_value FROM translations 
         WHERE translation_key = ? AND language_code = 'gu'`,
        [fix.key]
      );

      if (rows.length > 0) {
        const current = rows[0].translation_value;
        if (current === fix.newValue) {
          console.log(`✅ ${fix.key}: ${current}`);
        } else {
          console.log(`❌ ${fix.key}: ${current} (expected: ${fix.newValue})`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await connection.end();
  }
}

fixCustomerGujarati();
