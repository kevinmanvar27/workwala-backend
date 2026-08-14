import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requirePermission } from '@/lib/apiAuth';
import { query } from '@/lib/db';
import { logActivity, getClientIp } from '@/lib/activityLogger';

// GET /api/admin/users
export async function GET(req: NextRequest) {
  const { error } = await requirePermission(req, 'users.view');
  if (error) return error;

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;
    const deleted = searchParams.get('deleted') === '1';

    const searchWild = `%${search}%`;
    const deletedFilter = deleted ? 'u.deleted_at IS NOT NULL' : 'u.deleted_at IS NULL';

    const users = await query<{
      id: number; name: string; email: string; avatar: string;
      role_id: number; role_name: string; status: string; created_at: string;
    }[]>(
      `SELECT u.id, u.name, u.email, u.avatar, u.role_id, r.name as role_name, u.status, u.created_at
       FROM users u LEFT JOIN roles r ON r.id = u.role_id
       WHERE ${deletedFilter} AND (u.name LIKE ? OR u.email LIKE ?)
       ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
      [searchWild, searchWild, limit, offset]
    );

    const [total] = await query<{ count: number }[]>(
      `SELECT COUNT(*) as count FROM users u WHERE ${deletedFilter} AND (u.name LIKE ? OR u.email LIKE ?)`,
      [searchWild, searchWild]
    );

    return NextResponse.json({ users, total: total.count, page, limit });
  } catch (err) {
    console.error('Users GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/users
export async function POST(req: NextRequest) {
  const { error, user: actor } = await requirePermission(req, 'users.create');
  if (error) return error;

  try {
    const { name, email, password, role_id, status } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email and password are required' }, { status: 400 });
    }

    const existing = await query<{ id: number }[]>(
      `SELECT id FROM users WHERE email = ? AND deleted_at IS NULL`, [email]
    );
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
    }

    const hashed = await bcrypt.hash(password, 12);
    const result = await query<{ insertId: number }>(
      `INSERT INTO users (name, email, password, role_id, status) VALUES (?, ?, ?, ?, ?)`,
      [name, email, hashed, role_id || null, status || 'active']
    );

    await logActivity({
      userId: actor!.userId, userName: actor!.email,
      action: 'Created', module: 'users',
      targetId: result.insertId, targetName: name,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true, id: result.insertId }, { status: 201 });
  } catch (err) {
    console.error('Users POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
