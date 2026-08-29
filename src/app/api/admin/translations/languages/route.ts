/**
 * Admin API: Manage Languages
 * 
 * GET    /api/admin/translations/languages - List all languages with stats
 * POST   /api/admin/translations/languages - Add new language
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requirePermission } from '@/lib/apiAuth';
import pool from '@/lib/db';
import {
  getEnglishTranslationKeys,
  translateAllKeysAtOnce,
  batchInsertTranslations,
} from '@/lib/translate';

interface Language {
  id: number;
  code: string;
  name: string;
  native_name: string;
  is_active: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

interface TranslationCount {
  language_code: string;
  count: number;
}

// GET - List all languages with translation counts
export async function GET(request: NextRequest) {
  const { error } = await requirePermission(request, 'settings.view');
  if (error) {
    console.error('Permission check failed:', error);
    return error;
  }

  try {
    console.log('Fetching languages from database...');

    // Fetch all languages
    const languages = await query<Language[]>(
      `SELECT * FROM languages ORDER BY sort_order ASC, name ASC`
    );

    console.log('Languages fetched:', languages.length);

    // Get translation counts for each language
    const translationCounts = await query<TranslationCount[]>(
      `SELECT language_code, COUNT(*) as count 
       FROM translations 
       GROUP BY language_code`
    );

    console.log('Translation counts:', translationCounts);

    // Merge counts with languages
    const languagesWithCounts = languages.map(lang => ({
      ...lang,
      translation_count: translationCounts.find(tc => tc.language_code === lang.code)?.count || 0,
    }));

    console.log('Returning languages with counts:', languagesWithCounts);

    return NextResponse.json({
      success: true,
      languages: languagesWithCounts,
    });

  } catch (error) {
    console.error('Error fetching languages:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch languages',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// POST - Add new language
export async function POST(request: NextRequest) {
  const { error, user: actor } = await requirePermission(request, 'settings.view');
  if (error) return error;

  try {

    const body = await request.json();
    const { code, name, native_name, sort_order = 999 } = body;

    // Validate required fields
    if (!code || !name || !native_name) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: code, name, native_name',
        },
        { status: 400 }
      );
    }

    // Validate language code format (2-3 lowercase letters)
    if (!/^[a-z]{2,3}$/.test(code)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid language code. Must be 2-3 lowercase letters (e.g., en, hi, pa)',
        },
        { status: 400 }
      );
    }

    // Check if language already exists
    const existing = await query<Language[]>(
      `SELECT * FROM languages WHERE code = ?`,
      [code]
    );

    if (existing.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Language code already exists',
        },
        { status: 400 }
      );
    }

    // Insert new language
    await query(
      `INSERT INTO languages (code, name, native_name, is_active, sort_order) 
       VALUES (?, ?, ?, TRUE, ?)`,
      [code, name, native_name, sort_order]
    );

    // Initialize translation version
    await query(
      `INSERT INTO translation_versions (language_code, version, change_summary) 
       VALUES (?, '1.0.0', 'Initial version')`,
      [code]
    );

    // Auto-translate all keys from English ARB file
    console.log(`🌐 Auto-translating keys for new language: ${code}`);
    try {
      // Step 1: Get all English translation keys from ARB file
      const englishKeys = await getEnglishTranslationKeys();
      console.log(`✅ Found ${englishKeys.length} keys to translate`);

      // Step 2: Translate all keys to target language (BULK - all at once)
      const translations = await translateAllKeysAtOnce(englishKeys, code);
      console.log(`✅ Translation completed: ${translations.size} keys`);

      // Step 3: Insert translations into database
      await batchInsertTranslations(pool, code, englishKeys, translations);
      console.log(`✅ Auto-translation completed for ${code}`);

      return NextResponse.json({
        success: true,
        message: `Language added successfully with ${englishKeys.length} auto-translated keys`,
        language: { code, name, native_name, is_active: true, sort_order },
        translation_stats: {
          total_keys: englishKeys.length,
          translated: translations.size,
        },
      });

    } catch (translateError) {
      console.error('⚠️ Auto-translation failed, but language was created:', translateError);
      
      // Language was created successfully, but translation failed
      return NextResponse.json({
        success: true,
        message: 'Language added successfully, but auto-translation failed. Please use the auto-translate button.',
        language: { code, name, native_name, is_active: true, sort_order },
        translation_error: translateError instanceof Error ? translateError.message : 'Unknown error',
      });
    }

  } catch (error) {
    console.error('Error adding language:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to add language',
      },
      { status: 500 }
    );
  }
}
