import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const pages = await query<{ id: number; title: string; slug: string; created_at: string }[]>(
      `SELECT id, title, slug, created_at FROM pages
       WHERE deleted_at IS NULL AND status = 'published'
       ORDER BY title ASC`
    );
    return NextResponse.json({ pages });
  } catch (err) {
    console.error('Public pages error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
