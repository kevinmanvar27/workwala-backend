/**
 * GET /api/public/translations/[languageCode]
 * 
 * Returns all translations for a specific language
 * Used by app to download translations when user selects a language
 * 
 * Response:
 * {
 *   "success": true,
 *   "languageCode": "en",
 *   "version": "1.0.0",
 *   "updatedAt": "2026-08-29T07:00:00.000Z",
 *   "translations": {
 *     "welcomeMessage": "Welcome!",
 *     "loginButton": "Login",
 *     ...
 *   }
 * }
 */

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface Translation {
  translation_key: string;
  translation_value: string;
}

interface TranslationVersion {
  version: string;
  updated_at: Date;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ languageCode: string }> }
) {
  try {
    const { languageCode } = await params;

    // Validate language code
    if (!languageCode || !/^[a-z]{2,3}$/.test(languageCode)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid language code',
        },
        { status: 400 }
      );
    }

    // Check if language exists and is active
    const [language] = await query<Array<{ code: string }>>(
      `SELECT code FROM languages WHERE code = ? AND is_active = TRUE`,
      [languageCode]
    );

    if (!language) {
      return NextResponse.json(
        {
          success: false,
          error: 'Language not found or inactive',
        },
        { status: 404 }
      );
    }

    // Fetch all translations for this language
    const translations = await query<Translation[]>(
      `SELECT translation_key, translation_value 
       FROM translations 
       WHERE language_code = ?
       ORDER BY translation_key ASC`,
      [languageCode]
    );

    // Fetch version info
    const [versionInfo] = await query<TranslationVersion[]>(
      `SELECT version, updated_at 
       FROM translation_versions 
       WHERE language_code = ?`,
      [languageCode]
    );

    // Transform array to object { key: value }
    const translationsObject: Record<string, string> = {};
    translations.forEach(t => {
      translationsObject[t.translation_key] = t.translation_value;
    });

    return NextResponse.json({
      success: true,
      languageCode,
      version: versionInfo?.version || '1.0.0',
      updatedAt: versionInfo?.updated_at || new Date(),
      count: translations.length,
      translations: translationsObject,
    });

  } catch (error) {
    console.error('Error fetching translations:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch translations',
      },
      { status: 500 }
    );
  }
}
