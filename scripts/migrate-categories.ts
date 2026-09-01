// IMPORTANT: Load environment variables BEFORE importing db module
// The db module creates the connection pool at import time
import { config } from 'dotenv';
config();

import { query } from '../src/lib/db';

/**
 * Migration script to convert comma-separated categories to JSON array format
 * Converts: "Driver,Cooking" → ["Driver","Cooking"]
 */

async function migrateCategories() {
  try {
    console.log('🔄 Starting categories migration...\n');
    console.log(`📋 Database: ${process.env.DB_NAME || 'linko'}\n`);
    
    // Get all partners with non-JSON categories
    const partners = await query<any[]>(
      `SELECT id, phone, name, categories 
       FROM partners 
       WHERE deleted_at IS NULL 
         AND categories IS NOT NULL 
         AND categories != ''
         AND categories NOT LIKE '[%'`
    );
    
    console.log(`📋 Found ${partners.length} partner(s) with comma-separated categories\n`);
    
    if (partners.length === 0) {
      console.log('✅ No migration needed - all categories are already in JSON format\n');
      return;
    }
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const partner of partners) {
      try {
        console.log(`🔧 Partner #${partner.id} (${partner.phone}):`);
        console.log(`   OLD: ${partner.categories}`);
        
        // Split by comma and trim
        const categoriesArray = partner.categories
          .split(',')
          .map((c: string) => c.trim())
          .filter((c: string) => c.length > 0);
        
        const jsonCategories = JSON.stringify(categoriesArray);
        console.log(`   NEW: ${jsonCategories}`);
        
        // Update the database
        await query(
          `UPDATE partners SET categories = ? WHERE id = ?`,
          [jsonCategories, partner.id]
        );
        
        console.log(`   ✅ Updated successfully\n`);
        successCount++;
        
      } catch (error) {
        console.error(`   ❌ Error updating partner #${partner.id}:`, error);
        errorCount++;
      }
    }
    
    console.log('━'.repeat(80));
    console.log('📊 MIGRATION SUMMARY:');
    console.log(`   Total partners: ${partners.length}`);
    console.log(`   ✅ Successfully migrated: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log('━'.repeat(80));
    console.log('\n✅ Migration complete!\n');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    process.exit(0);
  }
}

migrateCategories();
