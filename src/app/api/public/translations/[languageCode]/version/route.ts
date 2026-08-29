/**
 * GET /api/public/translations/[languageCode]/version
 * 
 * Returns version info for a language (for cache invalidation)
 * App calls this to check if translations need to be updated
 * 
 * Response:
 * {
 *   "success": true,
 *   "languageCode": "en",
 *   "version": "1.0.0",
 *   "updatedAt": "2026-08-29T07:00:00.000Z"
 * }
 */

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

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

    // Fetch version info
    const [versionInfo] = await query<TranslationVersion[]>(
      `SELECT version, updated_at 
       FROM translation_versions 
       WHERE language_code = ?`,
      [languageCode]
    );

    if (!versionInfo) {
      return NextResponse.json(
        {
          success: false,
          error: 'Version info not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      languageCode,
      version: versionInfo.version,
      updatedAt: versionInfo.updated_at,
    });

  } catch (error) {
    console.error('Error fetching translation version:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch version info',
      },
      { status: 500 }
    );
  }
}
