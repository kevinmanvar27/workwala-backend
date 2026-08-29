import mysql from 'mysql2/promise';

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'workwala'
};

async function checkCustomerGujarati() {
  console.log('🔍 Checking Customer App Gujarati Translations\n');
  console.log('=' .repeat(80) + '\n');

  const connection = await mysql.createConnection(dbConfig);

  try {
    // Keys to check
    const keys = [
      'myBookings',
      'payments', 
      'logout',
      'logoutConfirmMessage',
      'logoutConfirmTitle',
      'claimNow',
      'flat100Off',
      'firstBookingOffer'
    ];

    for (const key of keys) {
      const [rows] = await connection.execute<any[]>(
        `SELECT translation_key, language_code, translation_value 
         FROM translations 
         WHERE translation_key = ? AND language_code IN ('en', 'gu', 'hi')
         ORDER BY language_code`,
        [key]
      );

      if (rows.length > 0) {
        console.log(`📌 ${key}:`);
        for (const row of rows) {
          console.log(`   [${row.language_code}] ${row.translation_value}`);
        }
        console.log();
      } else {
        console.log(`⚠️  ${key}: NOT FOUND IN DATABASE\n`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await connection.end();
  }
}

checkCustomerGujarati();
