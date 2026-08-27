/**
 * Script to seed Firebase credentials into settings table
 * Run: node scripts/seed_firebase_credentials.js
 */

const mysql = require('mysql2/promise');
const path = require('path');

// Load the correct env file based on NODE_ENV
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local';
require('dotenv').config({ path: path.resolve(process.cwd(), envFile) });

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'workwala',
};

// Firebase credentials from environment
const FIREBASE_CREDENTIALS = {
  fcm_project_id: process.env.FCM_PROJECT_ID || 'linko-e5bdf',
  fcm_client_email: process.env.FCM_CLIENT_EMAIL || 'firebase-adminsdk-fbsvc@linko-e5bdf.iam.gserviceaccount.com',
  fcm_private_key: process.env.FCM_PRIVATE_KEY || '',
};

async function seedFirebaseCredentials() {
  let connection;
  try {
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ Connected to MySQL');

    // Check if settings table exists
    const [tables] = await connection.query(
      `SHOW TABLES LIKE 'settings'`
    );

    if (tables.length === 0) {
      console.log('❌ Settings table does not exist. Creating it...');
      await connection.query(`
        CREATE TABLE settings (
          id INT AUTO_INCREMENT PRIMARY KEY,
          group_name VARCHAR(100) DEFAULT 'general',
          key_name VARCHAR(255) NOT NULL UNIQUE,
          value LONGTEXT,
          deleted_at TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Created settings table');
    }

    // Insert or update Firebase credentials
    const group = 'notifications';
    
    for (const [key, value] of Object.entries(FIREBASE_CREDENTIALS)) {
      if (!value) {
        console.log(`⚠️  Skipping ${key} - no value provided in environment`);
        continue;
      }

      await connection.query(
        `INSERT INTO settings (group_name, key_name, value)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE value = ?, updated_at = CURRENT_TIMESTAMP`,
        [group, key, value, value]
      );

      const maskedValue = key === 'fcm_private_key' 
        ? '***PRIVATE_KEY***' 
        : value.substring(0, 30) + '...';
      console.log(`✅ Saved ${key}: ${maskedValue}`);
    }

    console.log('');
    console.log('🎉 Firebase credentials seeded successfully!');
    console.log('');
    console.log('🔧 Next steps:');
    console.log('   1. Verify credentials in Admin → Settings → Notifications tab');
    console.log('   2. Test push notifications in Admin → Notifications → Test Notification');
    console.log('   3. Launch Flutter apps to register FCM tokens');

  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
    console.error(err);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

seedFirebaseCredentials();
