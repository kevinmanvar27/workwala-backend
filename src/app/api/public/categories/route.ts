import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET /api/public/categories
// No auth required — used by partner onboarding (before login)
export async function GET() {
  try {
    const rows = await query<{
      id: number;
      name: string;
      slug: string;
      is_active: number;
      sort_order: number;
    }[]>(
      `SELECT id, name, slug, sort_order
       FROM categories
       WHERE is_active = 1 AND deleted_at IS NULL
       ORDER BY sort_order ASC, id ASC`
    );

    return NextResponse.json({
      success: true,
      categories: rows.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
      })),
    });
  } catch (err) {
    console.error('public categories error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
