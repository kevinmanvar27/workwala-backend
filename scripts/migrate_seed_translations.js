/**
 * Migration: Seed All Translation Keys
 *
 * Inserts all 550 English keys (from translation-keys.json) into the
 * translations table for every language that exists in the DB.
 *
 * For English: inserts the original English values.
 * For other languages: inserts English values as placeholders so the app
 *   never crashes. Admins can then click "Auto-Translate" in the panel to
 *   replace them with proper translations.
 *
 * Uses INSERT IGNORE — existing translations (including any admin edits
 * or previously auto-translated values) are NEVER overwritten.
 *
 * Safe to run multiple times — fully idempotent.
 */

const mysql = require('mysql2/promise');
const path  = require('path');
const fs    = require('fs');

const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local';
require('dotenv').config({ path: path.resolve(process.cwd(), envFile) });

const DB_CONFIG = {
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '3306'),
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'workwala',
};

// Path to the bundled keys JSON (lives next to this script's compiled output,
// but during migration we read it from src/lib directly)
const KEYS_PATH = path.resolve(__dirname, '../src/lib/translation-keys.json');

async function run() {
  let conn;
  try {
    console.log('🚀 migrate_seed_translations: connecting to DB…');
    conn = await mysql.createConnection(DB_CONFIG);
    console.log('✅ Connected');

    // ── Load bundled English keys ──────────────────────────────────────────
    if (!fs.existsSync(KEYS_PATH)) {
      console.error(`❌ translation-keys.json not found at: ${KEYS_PATH}`);
      process.exit(1);
    }
    const rawKeys = JSON.parse(fs.readFileSync(KEYS_PATH, 'utf-8'));
    const keyEntries = Object.entries(rawKeys); // [[key, value], ...]
    console.log(`✅ Loaded ${keyEntries.length} English keys from translation-keys.json`);

    // ── Get all languages in DB ────────────────────────────────────────────
    const [languages] = await conn.execute('SELECT code FROM languages ORDER BY sort_order');
    console.log(`✅ Found ${languages.length} languages: ${languages.map(l => l.code).join(', ')}`);

    // ── Seed each language ─────────────────────────────────────────────────
    for (const lang of languages) {
      const code = lang.code;

      // Build batch INSERT IGNORE — English gets real values, others get English
      // as placeholder (admin uses Auto-Translate to fill proper translations)
      const placeholders = keyEntries.map(() => '(?, ?, ?, ?)').join(', ');
      const values = keyEntries.flatMap(([key, value]) => [code, key, value, 'general']);

      await conn.execute(
        `INSERT IGNORE INTO translations (language_code, translation_key, translation_value, category)
         VALUES ${placeholders}`,
        values
      );

      // Count how many rows exist now
      const [[{ cnt }]] = await conn.execute(
        'SELECT COUNT(*) as cnt FROM translations WHERE language_code = ?',
        [code]
      );
      console.log(`   ✅ [${code}] ${cnt} keys in DB (INSERT IGNORE — existing rows untouched)`);
    }

    // ── Ensure translation_versions row exists for every language ──────────
    for (const lang of languages) {
      await conn.execute(
        `INSERT IGNORE INTO translation_versions (language_code, version, change_summary)
         VALUES (?, '1.0.0', 'Seeded by migrate_seed_translations')`,
        [lang.code]
      );
    }
    console.log('   ✅ translation_versions rows ensured for all languages');

    console.log('\n✅ migrate_seed_translations: completed successfully');
  } catch (err) {
    console.error('\n❌ migrate_seed_translations failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

run();
