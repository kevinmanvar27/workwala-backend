import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// Simple test endpoint without authentication
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ languageCode: string }> }
) {
  try {
    const { languageCode } = await params;
    
    console.log('🧪 TEST: Fetching translations for:', languageCode);
    
    const [translations] = await pool.query(
      'SELECT * FROM translations WHERE language_code = ? LIMIT 5',
      [languageCode]
    );
    
    console.log('🧪 TEST: Found', (translations as any[]).length, 'translations');
    
    return NextResponse.json({
      success: true,
      languageCode,
      count: (translations as any[]).length,
      translations,
    });
  } catch (error) {
    console.error('🧪 TEST ERROR:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
