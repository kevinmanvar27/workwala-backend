import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/apiAuth';
import { query } from '@/lib/db';
import { logActivity, getClientIp } from '@/lib/activityLogger';

type Params = { params: Promise<{ id: string }> };

// GET /api/admin/roles/[id]
export async function GET(req: NextRequest, { params }: Params) {
  const { error } = await requirePermission(req, 'roles.view');
  if (error) return error;

  const { id } = await params;
  const roles = await query<{ id: number; name: string; slug: string; description: string }[]>(
    `SELECT id, name, slug, description FROM roles WHERE id = ? AND deleted_at IS NULL`, [id]
  );
  if (roles.length === 0) return NextResponse.json({ error: 'Role not found' }, { status: 404 });

  const permissions = await query<{ id: number }[]>(
    `SELECT permission_id as id FROM role_permissions WHERE role_id = ?`, [id]
  );

  return NextResponse.json({ role: roles[0], permissions: permissions.map((p) => p.id) });
}

// PUT /api/admin/roles/[id]
export async function PUT(req: NextRequest, { params }: Params) {
  const { error, user: actor } = await requirePermission(req, 'roles.edit');
  if (error) return error;

  const { id } = await params;
  try {
    const { name, slug, description, permissions } = await req.json();

    if (!name || !slug) {
      return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 });
    }
    if (name.length > 100) {
      return NextResponse.json({ error: 'Name must be 100 characters or fewer' }, { status: 400 });
    }
    if (slug.length > 100) {
      return NextResponse.json({ error: 'Slug must be 100 characters or fewer' }, { status: 400 });
    }

    const existing = await query<{ id: number }[]>(
      `SELECT id FROM roles WHERE id = ? AND deleted_at IS NULL`, [id]
    );
    if (existing.length === 0) return NextResponse.json({ error: 'Role not found' }, { status: 404 });

    await query(
      `UPDATE roles SET name=?, slug=?, description=?, updated_at=NOW() WHERE id=?`,
      [name, slug, description || null, id]
    );

    // Sync permissions
    await query(`DELETE FROM role_permissions WHERE role_id = ?`, [id]);
    if (permissions && permissions.length > 0) {
      for (const permId of permissions) {
        await query(
          `INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`,
          [id, permId]
        );
      }
    }

    await logActivity({
      userId: actor!.userId, userName: actor!.email,
      action: 'Updated', module: 'roles',
      targetId: Number(id), targetName: name,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Roles PUT error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/admin/roles/[id] — soft delete
export async function DELETE(req: NextRequest, { params }: Params) {
  const { error, user: actor } = await requirePermission(req, 'roles.delete');
  if (error) return error;

  const { id } = await params;
  try {
    const rows = await query<{ name: string }[]>(`SELECT name FROM roles WHERE id=?`, [id]);
    await query(
      `UPDATE roles SET deleted_at=NOW(), updated_at=NOW() WHERE id=? AND deleted_at IS NULL`, [id]
    );
    await logActivity({
      userId: actor!.userId, userName: actor!.email,
      action: 'Deleted', module: 'roles',
      targetId: Number(id), targetName: rows[0]?.name,
      ipAddress: getClientIp(req),
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Roles DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
