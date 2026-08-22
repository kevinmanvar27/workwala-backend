/**
 * Setup Script - Creates necessary directories
 * Run this after deployment to ensure all required directories exist
 */

const fs = require('fs');
const path = require('path');

const directories = [
  'public/uploads/customers',
  'public/uploads/partners',
  'public/uploads/documents',
  'public/uploads/categories',
];

console.log('🔧 Setting up required directories...\n');

directories.forEach((dir) => {
  const fullPath = path.join(process.cwd(), dir);
  
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`✅ Created: ${dir}`);
  } else {
    console.log(`⏭️  Already exists: ${dir}`);
  }
});

console.log('\n✅ Setup completed!\n');
