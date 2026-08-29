/**
 * Test endpoint to check if translations API is accessible
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/apiAuth';
import { translateText } from '@/lib/translate';

export async function GET(request: NextRequest) {
  const { error, user } = await requirePermission(request, 'settings.view');
  
  if (error) {
    return NextResponse.json({
      success: false,
      authenticated: false,
      error: 'Not authenticated or no permission',
    });
  }

  return NextResponse.json({
    success: true,
    authenticated: true,
    user: user || null,
    message: 'You have access to translations API',
  });
}

// POST - Test translation
export async function POST(request: NextRequest) {
  const { error } = await requirePermission(request, 'settings.view');
  
  if (error) {
    return error;
  }

  try {
    const body = await request.json();
    const { text, targetLanguage } = body;

    if (!text || !targetLanguage) {
      return NextResponse.json(
        {
          success: false,
          error: 'Text and targetLanguage are required',
        },
        { status: 400 }
      );
    }

    console.log(`🧪 Testing translation: "${text}" to ${targetLanguage}`);
    const translated = await translateText(text, targetLanguage);

    return NextResponse.json({
      success: true,
      original: text,
      translated,
      targetLanguage,
    });

  } catch (error) {
    console.error('❌ Translation test failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Translation test failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
