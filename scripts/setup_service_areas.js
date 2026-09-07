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

async function createServiceAreasTable() {
  let connection;
  try {
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ Connected to MySQL');
    console.log(`📦 Database: ${DB_CONFIG.database}\n`);

    // Create service_areas table
    console.log('📦 Creating service_areas table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS service_areas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL COMMENT 'Area name (e.g., "Mavdi, Rajkot")',
        latitude DECIMAL(10, 8) NOT NULL COMMENT 'Center point latitude (-90 to 90)',
        longitude DECIMAL(11, 8) NOT NULL COMMENT 'Center point longitude (-180 to 180)',
        radius_meters INT UNSIGNED NOT NULL COMMENT 'Coverage radius in meters',
        status ENUM('active', 'disabled') NOT NULL DEFAULT 'active' COMMENT 'Area availability status',
        city VARCHAR(100) DEFAULT NULL COMMENT 'City name for filtering (optional)',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_status (status),
        INDEX idx_city (city),
        INDEX idx_status_city (status, city),
        INDEX idx_coordinates (latitude, longitude)
        
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Service coverage areas for availability checks'
    `);
    console.log('✅ Table service_areas created');

    // Create permission
    console.log('\n📦 Creating service-areas.manage permission...');
    await connection.query(`
      INSERT INTO permissions (name, slug, module, description)
      VALUES (
        'Manage Service Areas',
        'service-areas.manage',
        'Service Areas',
        'Create, edit, delete, and toggle service coverage areas'
      )
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        module = VALUES(module),
        description = VALUES(description)
    `);
    console.log('✅ Permission created');

    // Assign to super-admin
    console.log('\n📦 Assigning permission to super-admin role...');
    await connection.query(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM roles r
      CROSS JOIN permissions p
      WHERE r.slug = 'super-admin' 
        AND p.slug = 'service-areas.manage'
        AND NOT EXISTS (
          SELECT 1 FROM role_permissions rp
          WHERE rp.role_id = r.id AND rp.permission_id = p.id
        )
    `);
    console.log('✅ Permission assigned to super-admin');

    // Insert test data
    console.log('\n📦 Inserting test service area...');
    await connection.query(`
      INSERT INTO service_areas (name, latitude, longitude, radius_meters, city, status)
      VALUES ('Mavdi, Rajkot', 22.2735, 70.7513, 5000, 'Rajkot', 'active')
    `);
    console.log('✅ Test data inserted');

    // Verify
    const [areas] = await connection.query('SELECT * FROM service_areas');
    console.log('\n📋 Service Areas:');
    console.table(areas);

    console.log('\n🎉 Setup complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    if (connection) await connection.end();
  }
}

createServiceAreasTable();
