const { execSync } = require('child_process');

console.log('🚀 Starting setup...\n');

try {
  console.log('📦 Running migrations...');
  execSync('node scripts/migrate.js', { stdio: 'inherit' });

  console.log('\n🌱 Running seeders...');
  execSync('node scripts/seed.js', { stdio: 'inherit' });

  console.log('\n✅ Setup complete! Run "npm run dev" to start the server.');
} catch (err) {
  console.error('❌ Setup failed:', err.message);
  process.exit(1);
}
