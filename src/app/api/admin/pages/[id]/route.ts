import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/apiAuth';
import { query } from '@/lib/db';
import { logActivity, getClientIp } from '@/lib/activityLogger';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { error } = await requirePermission(req, 'pages.view');
  if (error) return error;

  const { id } = await params;
  const pages = await query<{
    id: number; title: string; slug: string; content: string;
    meta_title: string; meta_description: string; status: string; created_at: string;
  }[]>(
    `SELECT id, title, slug, content, meta_title, meta_description, status, created_at
     FROM pages WHERE id = ? AND deleted_at IS NULL`, [id]
  );
  if (pages.length === 0) return NextResponse.json({ error: 'Page not found' }, { status: 404 });
  return NextResponse.json({ page: pages[0] });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { error, user: actor } = await requirePermission(req, 'pages.edit');
  if (error) return error;

  const { id } = await params;
  try {
    const { title, slug, content, meta_title, meta_description, status } = await req.json();

    const existing = await query<{ id: number }[]>(
      `SELECT id FROM pages WHERE id = ? AND deleted_at IS NULL`, [id]
    );
    if (existing.length === 0) return NextResponse.json({ error: 'Page not found' }, { status: 404 });

    const slugCheck = await query<{ id: number }[]>(
      `SELECT id FROM pages WHERE slug = ? AND id != ? AND deleted_at IS NULL`, [slug, id]
    );
    if (slugCheck.length > 0) return NextResponse.json({ error: 'Slug already in use' }, { status: 409 });

    await query(
      `UPDATE pages SET title=?, slug=?, content=?, meta_title=?, meta_description=?, status=?, updated_at=NOW() WHERE id=?`,
      [title, slug, content || '', meta_title || title, meta_description || '', status || 'draft', id]
    );

    await logActivity({
      userId: actor!.userId, userName: actor!.email,
      action: 'Updated', module: 'pages',
      targetId: Number(id), targetName: title,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Pages PUT error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { error, user: actor } = await requirePermission(req, 'pages.delete');
  if (error) return error;

  const { id } = await params;
  try {
    const rows = await query<{ title: string }[]>(`SELECT title FROM pages WHERE id=?`, [id]);
    await query(
      `UPDATE pages SET deleted_at=NOW(), updated_at=NOW() WHERE id=? AND deleted_at IS NULL`, [id]
    );
    await logActivity({
      userId: actor!.userId, userName: actor!.email,
      action: 'Deleted', module: 'pages',
      targetId: Number(id), targetName: rows[0]?.title,
      ipAddress: getClientIp(req),
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Pages DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
