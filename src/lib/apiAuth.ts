import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from './jwt';
import { query } from './db';

export async function requireAuth(req: NextRequest) {
  const token = req.cookies.get('auth_token')?.value;
  if (!token) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null };
  }
  const payload = verifyToken(token);
  if (!payload) {
    return { error: NextResponse.json({ error: 'Invalid token' }, { status: 401 }), user: null };
  }
  return { error: null, user: payload };
}

export async function requirePermission(req: NextRequest, permSlug: string) {
  const { error, user } = await requireAuth(req);
  if (error || !user) return { error: error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null };

  const rows = await query<{ slug: string }[]>(
    `SELECT p.slug FROM permissions p
     INNER JOIN role_permissions rp ON rp.permission_id = p.id
     INNER JOIN users u ON u.role_id = rp.role_id
     WHERE u.id = ? AND p.slug = ? AND u.deleted_at IS NULL AND p.deleted_at IS NULL`,
    [user.userId, permSlug]
  );

  if (rows.length === 0) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), user: null };
  }
  return { error: null, user };
}
