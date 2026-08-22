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
  database: process.env.DB_NAME || 'linko',
};

async function migrate() {
  let connection;
  try {
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ Connected to MySQL');

    // ─── Add category_id column to services table ────────────────────────────
    console.log('📦 Adding category_id column to services table...');
    
    // Check if column already exists
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'services' 
        AND COLUMN_NAME = 'category_id'
    `, [DB_CONFIG.database]);

    if (columns.length === 0) {
      // Add the column
      await connection.query(`
        ALTER TABLE services 
        ADD COLUMN category_id INT NULL AFTER slug,
        ADD FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
      `);
      console.log('✅ Added category_id column to services table');
    } else {
      console.log('ℹ️  category_id column already exists');
    }

    // ─── Link existing services to categories by matching slugs ──────────────
    console.log('📦 Linking services to categories...');
    
    // Get all services and categories
    const [services] = await connection.query('SELECT id, slug FROM services WHERE deleted_at IS NULL');
    const [categories] = await connection.query('SELECT id, slug FROM categories WHERE deleted_at IS NULL');
    
    // Create a map of category slugs to IDs
    const categoryMap = {};
    categories.forEach(cat => {
      categoryMap[cat.slug] = cat.id;
    });

    // Link services to categories based on matching slugs
    let linkedCount = 0;
    for (const service of services) {
      const categoryId = categoryMap[service.slug];
      if (categoryId) {
        await connection.query(
          'UPDATE services SET category_id = ? WHERE id = ?',
          [categoryId, service.id]
        );
        linkedCount++;
        console.log(`   ✓ Linked service "${service.slug}" to category ID ${categoryId}`);
      } else {
        console.log(`   ⚠ No matching category found for service "${service.slug}"`);
      }
    }

    console.log(`✅ Linked ${linkedCount} services to categories`);
    console.log('✅ Migration completed successfully');

  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

migrate();
