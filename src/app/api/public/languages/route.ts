/**
 * GET /api/public/languages
 * 
 * Returns list of all available languages
 * Used by app to show language selection screen
 * 
 * Response:
 * {
 *   "success": true,
 *   "languages": [
 *     { "code": "en", "name": "English", "nativeName": "English" },
 *     { "code": "hi", "name": "Hindi", "nativeName": "हिन्दी" }
 *   ]
 * }
 */

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface Language {
  code: string;
  name: string;
  native_name: string;
  sort_order: number;
}

export async function GET() {
  try {
    // Fetch all active languages ordered by sort_order
    const languages = await query<Language[]>(
      `SELECT code, name, native_name, sort_order 
       FROM languages 
       WHERE is_active = TRUE 
       ORDER BY sort_order ASC, name ASC`
    );

    // Transform to camelCase for frontend
    const formattedLanguages = languages.map(lang => ({
      code: lang.code,
      name: lang.name,
      nativeName: lang.native_name,
      sortOrder: lang.sort_order,
    }));

    return NextResponse.json({
      success: true,
      languages: formattedLanguages,
    });

  } catch (error) {
    console.error('Error fetching languages:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch languages',
      },
      { status: 500 }
    );
  }
}
