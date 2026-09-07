const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

// Load the correct env file based on NODE_ENV
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local';
require('dotenv').config({ path: path.resolve(process.cwd(), envFile) });

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
};

const DB_NAME = process.env.DB_NAME || 'linko';

async function runServiceAreaMigrations() {
  let connection;
  try {
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ Connected to MySQL');

    await connection.query(`USE \`${DB_NAME}\``);
    console.log(`✅ Using database "${DB_NAME}"`);

    // Run create_service_areas.sql
    console.log('\n📦 Running create_service_areas.sql...');
    const createTableSQL = fs.readFileSync(
      path.join(__dirname, '../migrations/create_service_areas.sql'),
      'utf8'
    );
    
    // Split by semicolon and execute each statement
    const statements = createTableSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      await connection.query(statement);
    }
    console.log('✅ Table: service_areas created');

    // Run add_service_area_permission.sql
    console.log('\n📦 Running add_service_area_permission.sql...');
    const permissionSQL = fs.readFileSync(
      path.join(__dirname, '../migrations/add_service_area_permission.sql'),
      'utf8'
    );
    
    const permStatements = permissionSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of permStatements) {
      await connection.query(statement);
    }
    console.log('✅ Permission: service-areas.manage created');

    console.log('\n🎉 Service Area migrations completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

runServiceAreaMigrations();
