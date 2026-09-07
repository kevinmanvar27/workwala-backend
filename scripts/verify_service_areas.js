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

async function verify() {
  let connection;
  try {
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ Connected to MySQL\n');

    // Check service_areas table
    console.log('📋 Service Areas Table Structure:');
    const [columns] = await connection.query('DESCRIBE service_areas');
    console.table(columns);

    // Check permission
    console.log('\n📋 Service Area Permission:');
    const [perm] = await connection.query(
      "SELECT * FROM permissions WHERE slug = 'service-areas.manage'"
    );
    console.table(perm);

    // Check if assigned to super-admin
    console.log('\n📋 Permission Assignment to Super Admin:');
    const [assignment] = await connection.query(`
      SELECT r.name as role_name, p.name as permission_name, p.slug
      FROM role_permissions rp
      JOIN roles r ON r.id = rp.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE p.slug = 'service-areas.manage'
    `);
    console.table(assignment);

    // Insert test data
    console.log('\n📦 Inserting test service area...');
    await connection.query(`
      INSERT INTO service_areas (name, latitude, longitude, radius_meters, city, status)
      VALUES ('Mavdi, Rajkot', 22.2735, 70.7513, 5000, 'Rajkot', 'active')
      ON DUPLICATE KEY UPDATE name = name
    `);

    // Query test data
    const [areas] = await connection.query('SELECT * FROM service_areas LIMIT 5');
    console.log('\n📋 Service Areas (Sample):');
    console.table(areas);

    console.log('\n✅ Verification complete!');

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  } finally {
    if (connection) await connection.end();
  }
}

verify();
