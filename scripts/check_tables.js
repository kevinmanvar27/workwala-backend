const mysql = require('mysql2/promise');
const path = require('path');

// Load env
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local';
require('dotenv').config({ path: path.resolve(process.cwd(), envFile) });

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'linko'
};

async function checkTables() {
  let connection;
  try {
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ Connected to MySQL');
    console.log(`📦 Database: ${DB_CONFIG.database}\n`);

    // Show all tables
    const [tables] = await connection.query('SHOW TABLES');
    console.log('📋 All Tables in Database:');
    console.table(tables);

    // Check if service_areas exists
    const [exists] = await connection.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = ? AND table_name = 'service_areas'
    `, [DB_CONFIG.database]);

    console.log(`\n🔍 service_areas table exists: ${exists[0].count > 0 ? 'YES ✅' : 'NO ❌'}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) await connection.end();
  }
}

checkTables();
