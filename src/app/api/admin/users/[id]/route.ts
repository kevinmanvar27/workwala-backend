import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requirePermission } from '@/lib/apiAuth';
import { query } from '@/lib/db';
import { logActivity, getClientIp } from '@/lib/activityLogger';

type Params = { params: Promise<{ id: string }> };

// GET /api/admin/users/[id]
export async function GET(req: NextRequest, { params }: Params) {
  const { error } = await requirePermission(req, 'users.view');
  if (error) return error;

  const { id } = await params;
  const users = await query<{
    id: number; name: string; email: string; avatar: string;
    role_id: number; role_name: string; status: string; created_at: string;
  }[]>(
    `SELECT u.id, u.name, u.email, u.avatar, u.role_id, r.name as role_name, u.status, u.created_at
     FROM users u LEFT JOIN roles r ON r.id = u.role_id
     WHERE u.id = ? AND u.deleted_at IS NULL`,
    [id]
  );

  if (users.length === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  return NextResponse.json({ user: users[0] });
}

// PUT /api/admin/users/[id]
export async function PUT(req: NextRequest, { params }: Params) {
  const { error, user: actor } = await requirePermission(req, 'users.edit');
  if (error) return error;

  const { id } = await params;
  try {
    const { name, email, password, role_id, status } = await req.json();

    // Validate required fields
    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
    }
    // Field length caps
    if (name.length > 100) {
      return NextResponse.json({ error: 'Name must be 100 characters or fewer' }, { status: 400 });
    }
    // Email format validation — same rule as the create route
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    const existing = await query<{ id: number }[]>(
      `SELECT id FROM users WHERE id = ? AND deleted_at IS NULL`, [id]
    );
    if (existing.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check email uniqueness
    const emailCheck = await query<{ id: number }[]>(
      `SELECT id FROM users WHERE email = ? AND id != ? AND deleted_at IS NULL`, [email, id]
    );
    if (emailCheck.length > 0) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
    }

    if (password) {
      // Enforce same minimum length as the create route
      if (password.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
      }
      const hashed = await bcrypt.hash(password, 12);
      await query(
        `UPDATE users SET name=?, email=?, password=?, role_id=?, status=?, updated_at=NOW() WHERE id=?`,
        [name, email, hashed, role_id || null, status || 'active', id]
      );
    } else {
      await query(
        `UPDATE users SET name=?, email=?, role_id=?, status=?, updated_at=NOW() WHERE id=?`,
        [name, email, role_id || null, status || 'active', id]
      );
    }

    await logActivity({
      userId: actor!.userId, userName: actor!.email,
      action: 'Updated', module: 'users',
      targetId: Number(id), targetName: name,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Users PUT error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/admin/users/[id] — restore soft-deleted user
export async function PATCH(req: NextRequest, { params }: Params) {
  const { error, user: actor } = await requirePermission(req, 'users.edit');
  if (error) return error;

  const { id } = await params;
  try {
    const result = await query<{ affectedRows: number }>(
      `UPDATE users SET deleted_at=NULL, updated_at=NOW() WHERE id=? AND deleted_at IS NOT NULL`,
      [id]
    );
    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'User not found or not deleted' }, { status: 404 });
    }
    await logActivity({
      userId: actor!.userId, userName: actor!.email,
      action: 'Restored', module: 'users', targetId: Number(id),
      ipAddress: getClientIp(req),
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Users PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/admin/users/[id] — soft delete
export async function DELETE(req: NextRequest, { params }: Params) {
  const { error, user: actor } = await requirePermission(req, 'users.delete');
  if (error) return error;

  const { id } = await params;
  try {
    // Grab name before deleting for the log
    const rows = await query<{ name: string }[]>(`SELECT name FROM users WHERE id=?`, [id]);
    await query(
      `UPDATE users SET deleted_at=NOW(), updated_at=NOW() WHERE id=? AND deleted_at IS NULL`,
      [id]
    );
    await logActivity({
      userId: actor!.userId, userName: actor!.email,
      action: 'Deleted', module: 'users',
      targetId: Number(id), targetName: rows[0]?.name,
      ipAddress: getClientIp(req),
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Users DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
