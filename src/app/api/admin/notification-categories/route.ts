import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/apiAuth';
import { query } from '@/lib/db';
import { logActivity, getClientIp } from '@/lib/activityLogger';

function slugify(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// GET /api/admin/notification-categories
export async function GET(req: NextRequest) {
  const { error } = await requirePermission(req, 'notifications.view');
  if (error) return error;

  try {
    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get('active') === '1';

    const rows = await query<{
      id: number; name: string; slug: string; description: string | null;
      color: string; is_active: number; sort_order: number;
      created_at: string; updated_at: string;
    }[]>(
      `SELECT id, name, slug, description, color, is_active, sort_order, created_at, updated_at
       FROM notification_categories
       WHERE deleted_at IS NULL
         ${activeOnly ? 'AND is_active = 1' : ''}
       ORDER BY sort_order ASC, id ASC`
    );

    return NextResponse.json({ success: true, categories: rows });
  } catch (err) {
    console.error('notification-categories GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/notification-categories — create
export async function POST(req: NextRequest) {
  const { error, user: actor } = await requirePermission(req, 'notifications.create');
  if (error) return error;

  try {
    const body = await req.json();
    const { name, description, color, is_active, sort_order } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (name.trim().length > 100) {
      return NextResponse.json({ error: 'Name must be 100 characters or fewer' }, { status: 400 });
    }

    const slug = slugify(name);
    const existing = await query<{ id: number }[]>(
      'SELECT id FROM notification_categories WHERE slug = ? AND deleted_at IS NULL',
      [slug]
    );
    if (existing.length > 0) {
      return NextResponse.json({ error: 'A category with this name already exists' }, { status: 409 });
    }

    const result = await query<{ insertId: number }>(
      `INSERT INTO notification_categories (name, slug, description, color, is_active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        name.trim(),
        slug,
        description?.trim() || null,
        color || '#6B9BFA',
        is_active === false ? 0 : 1,
        sort_order ?? 0,
      ]
    );

    await logActivity({
      userId: actor!.userId, userName: actor!.email,
      action: 'Created', module: 'notification_categories',
      targetId: result.insertId, targetName: name.trim(),
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true, id: result.insertId }, { status: 201 });
  } catch (err) {
    console.error('notification-categories POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/admin/notification-categories — update
export async function PATCH(req: NextRequest) {
  const { error, user: actor } = await requirePermission(req, 'notifications.create');
  if (error) return error;

  try {
    const body = await req.json();
    const { id, name, description, color, is_active, sort_order } = body;

    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    // Length cap on update — same rule as create
    if (name !== undefined && name.trim().length > 100) {
      return NextResponse.json({ error: 'Name must be 100 characters or fewer' }, { status: 400 });
    }

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (name !== undefined) {
      fields.push('name = ?', 'slug = ?');
      values.push(name.trim(), slugify(name));
    }
    if (description !== undefined) { fields.push('description = ?'); values.push(description?.trim() || null); }
    if (color !== undefined) { fields.push('color = ?'); values.push(color); }
    if (is_active !== undefined) { fields.push('is_active = ?'); values.push(is_active ? 1 : 0); }
    if (sort_order !== undefined) { fields.push('sort_order = ?'); values.push(sort_order); }

    if (fields.length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

    values.push(id);
    await query(`UPDATE notification_categories SET ${fields.join(', ')} WHERE id = ? AND deleted_at IS NULL`, values);

    await logActivity({
      userId: actor!.userId, userName: actor!.email,
      action: 'Updated', module: 'notification_categories',
      targetId: id, targetName: name,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('notification-categories PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/admin/notification-categories — soft delete
export async function DELETE(req: NextRequest) {
  const { error, user: actor } = await requirePermission(req, 'notifications.delete');
  if (error) return error;

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    // Check if any non-draft notifications use this category
    const inUse = await query<{ count: number }[]>(
      `SELECT COUNT(*) as count FROM push_notifications
       WHERE category_id = ? AND status != 'draft' AND deleted_at IS NULL`,
      [id]
    );
    if (inUse[0]?.count > 0) {
      return NextResponse.json(
        { error: 'Cannot delete: this category is used by sent or scheduled notifications' },
        { status: 409 }
      );
    }

    await query(
      'UPDATE notification_categories SET deleted_at = NOW() WHERE id = ?',
      [id]
    );

    await logActivity({
      userId: actor!.userId, userName: actor!.email,
      action: 'Deleted', module: 'notification_categories',
      targetId: id,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('notification-categories DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
