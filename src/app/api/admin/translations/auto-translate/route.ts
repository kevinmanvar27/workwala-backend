/**
 * Admin API: Auto-translate Language
 * 
 * POST /api/admin/translations/auto-translate - Auto-translate all keys for a language
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requirePermission } from '@/lib/apiAuth';
import {
  getEnglishTranslationKeys,
  translateAllKeysAtOnce,
  batchInsertTranslations,
} from '@/lib/translate';

// POST - Auto-translate all keys for a language
export async function POST(request: NextRequest) {
  const { error } = await requirePermission(request, 'settings.edit');
  if (error) {
    console.error('Permission check failed:', error);
    return error;
  }

  try {
    const body = await request.json();
    const { languageCode } = body;

    if (!languageCode) {
      return NextResponse.json(
        {
          success: false,
          error: 'Language code is required',
        },
        { status: 400 }
      );
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🌐 AUTO-TRANSLATE STARTED: ${languageCode.toUpperCase()}`);
    console.log(`${'='.repeat(60)}\n`);

    // Step 1: Get all English translation keys from ARB file
    console.log('📖 Step 1/4: Reading English ARB file...');
    const englishKeys = await getEnglishTranslationKeys();
    console.log(`✅ Found ${englishKeys.length} keys to translate\n`);

    if (englishKeys.length === 0) {
      throw new Error('No translation keys found in English ARB file');
    }

    // Step 2: Translate all keys to target language
    console.log(`🔄 Step 2/4: Translating to ${languageCode}...`);
    console.log(`⚠️ Using BULK translation (all at once).\n`);
    const translations = await translateAllKeysAtOnce(englishKeys, languageCode);
    console.log(`\n✅ Translation completed: ${translations.size} keys processed\n`);

    // Step 3: Insert translations into database
    console.log('💾 Step 3/4: Saving translations to database...');
    await batchInsertTranslations(pool, languageCode, englishKeys, translations);
    console.log('✅ Translations saved successfully\n');

    // Step 4: Update translation version
    console.log('📝 Step 4/4: Updating translation version...');
    await pool.query(
      `UPDATE translation_versions 
       SET version = CONCAT(SUBSTRING_INDEX(version, '.', 1), '.', 
                           CAST(SUBSTRING_INDEX(version, '.', -1) AS UNSIGNED) + 1),
           change_summary = 'Auto-translated from English',
           updated_at = NOW()
       WHERE language_code = ?`,
      [languageCode]
    );
    console.log('✅ Version updated\n');

    console.log(`${'='.repeat(60)}`);
    console.log(`✅ AUTO-TRANSLATE COMPLETED: ${languageCode.toUpperCase()}`);
    console.log(`${'='.repeat(60)}\n`);

    return NextResponse.json({
      success: true,
      message: `Successfully auto-translated ${englishKeys.length} keys to ${languageCode}`,
      stats: {
        total_keys: englishKeys.length,
        translated: translations.size,
      },
    });

  } catch (error) {
    console.error('❌ Error during auto-translation:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('Error details:', {
      message: error instanceof Error ? error.message : String(error),
      type: typeof error,
      keys: Object.keys(error as any),
    });
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to auto-translate',
        details: error instanceof Error ? error.message : String(error),
        hint: 'Check server logs for detailed error information. The free Google Translate API may be blocked or rate-limited.',
      },
      { status: 500 }
    );
  }
}
