import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/apiAuth';
import { query } from '@/lib/db';
import { logActivity, getClientIp } from '@/lib/activityLogger';

// GET /api/admin/roles
export async function GET(req: NextRequest) {
  const { error } = await requirePermission(req, 'roles.view');
  if (error) return error;

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const page   = parseInt(searchParams.get('page')  || '1');
    const limit  = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;
    const searchWild = `%${search}%`;

    const roles = await query<{
      id: number; name: string; slug: string; description: string;
      created_at: string; permission_count: number; user_count: number;
    }[]>(
      `SELECT r.id, r.name, r.slug, r.description, r.created_at,
              COUNT(DISTINCT rp.permission_id) as permission_count,
              COUNT(DISTINCT u.id) as user_count
       FROM roles r
       LEFT JOIN role_permissions rp ON rp.role_id = r.id
       LEFT JOIN users u ON u.role_id = r.id AND u.deleted_at IS NULL
       WHERE r.deleted_at IS NULL AND (r.name LIKE ? OR r.slug LIKE ?)
       GROUP BY r.id ORDER BY r.id ASC
       LIMIT ? OFFSET ?`,
      [searchWild, searchWild, limit, offset]
    );

    const [total] = await query<{ count: number }[]>(
      `SELECT COUNT(*) as count FROM roles WHERE deleted_at IS NULL AND (name LIKE ? OR slug LIKE ?)`,
      [searchWild, searchWild]
    );

    return NextResponse.json({ roles, total: total.count, page, limit });
  } catch (err) {
    console.error('Roles GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/roles
export async function POST(req: NextRequest) {
  const { error, user: actor } = await requirePermission(req, 'roles.create');
  if (error) return error;

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
      `SELECT id FROM roles WHERE slug = ? AND deleted_at IS NULL`, [slug]
    );
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Slug already exists' }, { status: 409 });
    }

    const result = await query<{ insertId: number }>(
      `INSERT INTO roles (name, slug, description) VALUES (?, ?, ?)`,
      [name, slug, description || null]
    );

    const roleId = result.insertId;

    if (permissions && permissions.length > 0) {
      for (const permId of permissions) {
        await query(
          `INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`,
          [roleId, permId]
        );
      }
    }

    await logActivity({
      userId: actor!.userId, userName: actor!.email,
      action: 'Created', module: 'roles',
      targetId: roleId, targetName: name,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true, id: roleId }, { status: 201 });
  } catch (err) {
    console.error('Roles POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
