const mysql = require('mysql2/promise');
const path = require('path');

// Load the correct env file
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local';
require('dotenv').config({ path: path.resolve(process.cwd(), envFile) });

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'workwala',
};

async function seedCategoryIcons() {
  let connection;
  try {
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ Connected to MySQL');

    // ─── Check if categories exist ────────────────────────────────────────────
    const [categories] = await connection.query(`
      SELECT id, slug, name, icon_path 
      FROM categories 
      WHERE deleted_at IS NULL
    `);

    if (categories.length === 0) {
      console.log('ℹ️  No categories found. Creating default categories...');
      
      // Create default categories with icons
      const defaultCategories = [
        {
          name: 'Loading Unloading',
          slug: 'loading-unloading',
          price: 120.00,
          bg: '#F0F5FF',
          border: '#6B9BFA',
          icon: '/icons/categories/loading-unloading.png',
          iconColor: '#6B9BFA',
          sort: 1
        },
        {
          name: 'House Keeping',
          slug: 'house-keeping',
          price: 100.00,
          bg: '#F0FAF4',
          border: '#4AC48B',
          icon: '/icons/categories/house-keeping.png',
          iconColor: '#4AC48B',
          sort: 2
        },
        {
          name: 'Bathroom Cleaning',
          slug: 'bathroom-cleaning',
          price: 80.00,
          bg: '#FFF0F5',
          border: '#D677B7',
          icon: '/icons/categories/bathroom-cleaning.png',
          iconColor: '#D677B7',
          sort: 3
        },
        {
          name: 'Cooking',
          slug: 'cooking',
          price: 150.00,
          bg: '#FFF8EA',
          border: '#D9A05B',
          icon: '/icons/categories/cooking.png',
          iconColor: '#D9A05B',
          sort: 4
        },
        {
          name: 'Driver',
          slug: 'driver',
          price: 200.00,
          bg: '#FCF0F0',
          border: '#C77878',
          icon: '/icons/categories/driver.png',
          iconColor: '#C77878',
          sort: 5
        }
      ];

      for (const cat of defaultCategories) {
        await connection.query(`
          INSERT INTO categories 
          (name, slug, price_per_hour, bg_color, border_color, icon_path, icon_color, sort_order, is_active)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
          ON DUPLICATE KEY UPDATE
            icon_path = VALUES(icon_path),
            icon_color = VALUES(icon_color)
        `, [cat.name, cat.slug, cat.price, cat.bg, cat.border, cat.icon, cat.iconColor, cat.sort]);
        
        console.log(`   ✓ Created/Updated category: ${cat.name} with icon: ${cat.icon}`);
      }
    } else {
      console.log(`ℹ️  Found ${categories.length} categories. Updating icon paths...`);
      
      // Map of slug to icon path
      const iconMap = {
        'loading-unloading': '/icons/categories/loading-unloading.png',
        'house-keeping': '/icons/categories/house-keeping.png',
        'bathroom-cleaning': '/icons/categories/bathroom-cleaning.png',
        'cooking': '/icons/categories/cooking.png',
        'driver': '/icons/categories/driver.png',
      };

      // Map of slug to icon color (matching border color)
      const colorMap = {
        'loading-unloading': '#6B9BFA',
        'house-keeping': '#4AC48B',
        'bathroom-cleaning': '#D677B7',
        'cooking': '#D9A05B',
        'driver': '#C77878',
      };

      let updatedCount = 0;
      for (const cat of categories) {
        const iconPath = iconMap[cat.slug];
        const iconColor = colorMap[cat.slug];
        
        if (iconPath) {
          await connection.query(`
            UPDATE categories 
            SET icon_path = ?, icon_color = ?
            WHERE id = ?
          `, [iconPath, iconColor, cat.id]);
          
          console.log(`   ✓ Updated ${cat.name}: icon_path = ${iconPath}, icon_color = ${iconColor}`);
          updatedCount++;
        } else {
          console.log(`   ⚠ No icon mapping found for: ${cat.slug}`);
        }
      }
      
      console.log(`✅ Updated ${updatedCount} categories with icon paths`);
    }

    console.log('✅ Category icons seeded successfully');

  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

seedCategoryIcons();
