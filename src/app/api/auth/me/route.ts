import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';
import { query } from '@/lib/db';
import { getUserPermissions } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const { error, user } = await requireAuth(req);
  if (error) return error;

  const users = await query<{ id: number; name: string; email: string; avatar: string; role_name: string; status: string }[]>(
    `SELECT u.id, u.name, u.email, u.avatar, r.name as role_name, u.status
     FROM users u LEFT JOIN roles r ON r.id = u.role_id
     WHERE u.id = ? AND u.deleted_at IS NULL`,
    [user!.userId]
  );

  if (users.length === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const permissions = await getUserPermissions(user!.userId);

  return NextResponse.json({ user: users[0], permissions });
}
