import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/apiAuth';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

interface Translation extends RowDataPacket {
  id: number;
  language_code: string;
  translation_key: string;
  translation_value: string;
  english_value: string;
  category: string | null;
  created_at: Date;
  updated_at: Date;
}

// GET /api/admin/translations/[languageCode] - Get all translations for a language
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ languageCode: string }> }
) {
  try {
    const { languageCode } = await params;
    console.log('🔍 GET translations endpoint called for:', languageCode);
    
    const { error } = await requirePermission(request, 'settings.view');
    if (error) return error;

    console.log('✅ User authorized');

    console.log('📝 Fetching translations for language:', languageCode);
    
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    // For non-English languages, JOIN with English to get the source value side-by-side
    const isEnglish = languageCode === 'en';

    let query: string;
    const queryParams: any[] = [];

    if (isEnglish) {
      query = `
        SELECT t.*, t.translation_value AS english_value
        FROM translations t
        WHERE t.language_code = ?
      `;
      queryParams.push(languageCode);
    } else {
      // LEFT JOIN with English translations to show source alongside target
      query = `
        SELECT 
          t.*,
          COALESCE(en.translation_value, '') AS english_value
        FROM translations t
        LEFT JOIN translations en 
          ON en.translation_key = t.translation_key 
          AND en.language_code = 'en'
        WHERE t.language_code = ?
      `;
      queryParams.push(languageCode);
    }

    if (search) {
      query += ' AND (t.translation_key LIKE ? OR t.translation_value LIKE ?)';
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    if (category) {
      query += ' AND t.category = ?';
      queryParams.push(category);
    }

    query += ' ORDER BY t.translation_key ASC LIMIT ? OFFSET ?';
    queryParams.push(limit, offset);

    console.log('🔍 Query:', query);
    console.log('🔍 Params:', queryParams);

    const [translations] = await pool.query<Translation[]>(query, queryParams);
    console.log('✅ Found translations:', translations.length);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM translations WHERE language_code = ?';
    const countParams: any[] = [languageCode];

    if (search) {
      countQuery += ' AND (translation_key LIKE ? OR translation_value LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`);
    }

    if (category) {
      countQuery += ' AND category = ?';
      countParams.push(category);
    }

    const [countResult] = await pool.query<RowDataPacket[]>(countQuery, countParams);
    const total = countResult[0]?.total || 0;

    // Get categories
    const [categories] = await pool.query<RowDataPacket[]>(
      'SELECT DISTINCT category FROM translations WHERE language_code = ? AND category IS NOT NULL ORDER BY category',
      [languageCode]
    );

    return NextResponse.json({
      success: true,
      translations,
      total,
      page,
      limit,
      categories: categories.map(c => c.category),
    });
  } catch (error) {
    console.error('Error fetching translations:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch translations' },
      { status: 500 }
    );
  }
}

// POST /api/admin/translations/[languageCode] - Add new translation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ languageCode: string }> }
) {
  try {
    const user = await requirePermission(request, 'settings.edit');
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { languageCode } = await params;
    const body = await request.json();
    const { key, value, category } = body;

    if (!key || !value) {
      return NextResponse.json(
        { success: false, error: 'Key and value are required' },
        { status: 400 }
      );
    }

    // Check if key already exists
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM translations WHERE language_code = ? AND translation_key = ?',
      [languageCode, key]
    );

    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Translation key already exists' },
        { status: 400 }
      );
    }

    // Insert translation
    await pool.query(
      'INSERT INTO translations (language_code, translation_key, translation_value, category) VALUES (?, ?, ?, ?)',
      [languageCode, key, value, category || 'general']
    );

    return NextResponse.json({
      success: true,
      message: 'Translation added successfully',
    });
  } catch (error) {
    console.error('Error adding translation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add translation' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/translations/[languageCode] - Update translation
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ languageCode: string }> }
) {
  try {
    const user = await requirePermission(request, 'settings.edit');
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { languageCode } = await params;
    const body = await request.json();
    const { key, value, category } = body;

    if (!key) {
      return NextResponse.json(
        { success: false, error: 'Key is required' },
        { status: 400 }
      );
    }

    // Update translation
    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE translations SET translation_value = ?, category = ?, updated_at = NOW() WHERE language_code = ? AND translation_key = ?',
      [value, category || 'general', languageCode, key]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { success: false, error: 'Translation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Translation updated successfully',
    });
  } catch (error) {
    console.error('Error updating translation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update translation' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/translations/[languageCode] - Delete translation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ languageCode: string }> }
) {
  try {
    const user = await requirePermission(request, 'settings.edit');
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { languageCode } = await params;
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json(
        { success: false, error: 'Key is required' },
        { status: 400 }
      );
    }

    // Delete translation
    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM translations WHERE language_code = ? AND translation_key = ?',
      [languageCode, key]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { success: false, error: 'Translation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Translation deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting translation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete translation' },
      { status: 500 }
    );
  }
}
