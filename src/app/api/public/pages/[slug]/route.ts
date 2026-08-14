import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

type Params = { params: Promise<{ slug: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { slug } = await params;
  try {
    const pages = await query<{
      id: number; title: string; slug: string; content: string;
      meta_title: string; meta_description: string; created_at: string;
    }[]>(
      `SELECT id, title, slug, content, meta_title, meta_description, created_at
       FROM pages WHERE slug = ? AND deleted_at IS NULL AND status = 'published'`,
      [slug]
    );
    if (pages.length === 0) return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    return NextResponse.json({ page: pages[0] });
  } catch (err) {
    console.error('Public page slug error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
