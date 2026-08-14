import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/apiAuth';
import { query } from '@/lib/db';
import { logActivity, getClientIp } from '@/lib/activityLogger';

// GET /api/admin/pages
export async function GET(req: NextRequest) {
  const { error } = await requirePermission(req, 'pages.view');
  if (error) return error;

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;
    const searchWild = `%${search}%`;

    const pages = await query<{
      id: number; title: string; slug: string; status: string; created_at: string;
    }[]>(
      `SELECT id, title, slug, status, created_at FROM pages
       WHERE deleted_at IS NULL AND (title LIKE ? OR slug LIKE ?)
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [searchWild, searchWild, limit, offset]
    );

    const [total] = await query<{ count: number }[]>(
      `SELECT COUNT(*) as count FROM pages WHERE deleted_at IS NULL AND (title LIKE ? OR slug LIKE ?)`,
      [searchWild, searchWild]
    );

    return NextResponse.json({ pages, total: total.count, page, limit });
  } catch (err) {
    console.error('Pages GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/pages
export async function POST(req: NextRequest) {
  const { error, user: actor } = await requirePermission(req, 'pages.create');
  if (error) return error;

  try {
    const { title, slug, content, meta_title, meta_description, status } = await req.json();

    if (!title || !slug) {
      return NextResponse.json({ error: 'Title and slug are required' }, { status: 400 });
    }

    const existing = await query<{ id: number }[]>(
      `SELECT id FROM pages WHERE slug = ? AND deleted_at IS NULL`, [slug]
    );
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Slug already exists' }, { status: 409 });
    }

    const result = await query<{ insertId: number }>(
      `INSERT INTO pages (title, slug, content, meta_title, meta_description, status) VALUES (?, ?, ?, ?, ?, ?)`,
      [title, slug, content || '', meta_title || title, meta_description || '', status || 'draft']
    );

    await logActivity({
      userId: actor!.userId, userName: actor!.email,
      action: 'Created', module: 'pages',
      targetId: result.insertId, targetName: title,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true, id: result.insertId }, { status: 201 });
  } catch (err) {
    console.error('Pages POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
