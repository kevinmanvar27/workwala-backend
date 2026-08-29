/**
 * Import ARB translations to database
 * This script reads all .arb files from the Flutter app and imports them into the database
 */

import * as fs from 'fs';
import * as path from 'path';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const ARB_FILES_PATH = path.join(__dirname, '../../Work-Wala-Partner/lib/l10n');

interface ArbFile {
  languageCode: string;
  filePath: string;
  translations: Record<string, any>;
}

async function main() {
  console.log('🚀 Starting ARB to Database Import');
  console.log('=====================================\n');

  // Create database connection
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'workwala',
  });

  console.log('✅ Connected to database:', process.env.DB_NAME);

  try {
    // Read all ARB files
    const arbFiles = await readArbFiles();
    console.log(`\n📁 Found ${arbFiles.length} ARB files:`);
    arbFiles.forEach(f => console.log(`   - ${f.languageCode}: ${Object.keys(f.translations).length} keys`));

    // Import each language
    for (const arbFile of arbFiles) {
      await importLanguage(connection, arbFile);
    }

    console.log('\n✅ Import completed successfully!');
    console.log('\n📊 Summary:');
    
    // Show summary
    const [languages] = await connection.query(
      'SELECT code, name, (SELECT COUNT(*) FROM translations WHERE language_code = languages.code) as translation_count FROM languages'
    );
    
    console.table(languages);

  } catch (error) {
    console.error('❌ Error during import:', error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

async function readArbFiles(): Promise<ArbFile[]> {
  const files = fs.readdirSync(ARB_FILES_PATH);
  const arbFiles: ArbFile[] = [];

  for (const file of files) {
    if (!file.endsWith('.arb')) continue;

    const match = file.match(/app_([a-z]{2})\.arb/);
    if (!match) continue;

    const languageCode = match[1];
    const filePath = path.join(ARB_FILES_PATH, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const translations = JSON.parse(content);

    arbFiles.push({
      languageCode,
      filePath,
      translations,
    });
  }

  return arbFiles;
}

async function importLanguage(connection: mysql.Connection, arbFile: ArbFile) {
  console.log(`\n📦 Importing ${arbFile.languageCode.toUpperCase()}...`);

  const { languageCode, translations } = arbFile;

  // Check if language exists in database
  const [existingLang] = await connection.query<any[]>(
    'SELECT code FROM languages WHERE code = ?',
    [languageCode]
  );

  if (existingLang.length === 0) {
    console.log(`   ⚠️  Language "${languageCode}" not found in database. Skipping...`);
    return;
  }

  // Delete existing translations for this language
  const [deleteResult] = await connection.query<any>(
    'DELETE FROM translations WHERE language_code = ?',
    [languageCode]
  );
  
  if (deleteResult.affectedRows > 0) {
    console.log(`   🗑️  Deleted ${deleteResult.affectedRows} existing translations`);
  }

  // Prepare translations for batch insert
  const translationsToInsert: any[] = [];
  let skippedMetadata = 0;

  for (const [key, value] of Object.entries(translations)) {
    // Skip metadata keys (keys starting with @)
    if (key.startsWith('@')) {
      skippedMetadata++;
      continue;
    }

    // Extract category from key (e.g., "auth_login" -> "auth")
    const category = key.includes('_') ? key.split('_')[0] : 'general';

    translationsToInsert.push([
      languageCode,
      key,
      value,
      category,
    ]);
  }

  // Batch insert translations
  if (translationsToInsert.length > 0) {
    await connection.query(
      `INSERT INTO translations (language_code, translation_key, translation_value, category) 
       VALUES ?`,
      [translationsToInsert]
    );
    console.log(`   ✅ Inserted ${translationsToInsert.length} translations`);
    console.log(`   ℹ️  Skipped ${skippedMetadata} metadata entries`);
  }
}

// Run the script
main().catch(console.error);
