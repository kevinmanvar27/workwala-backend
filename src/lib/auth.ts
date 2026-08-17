import { cookies } from 'next/headers';
import { verifyToken, JWTPayload } from './jwt';
import { query } from './db';

export async function getSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function getUserPermissions(userId: number): Promise<string[]> {
  // Super Admin bypass — return every permission in the system
  const roleRows = await query<{ slug: string }[]>(
    `SELECT r.slug FROM roles r INNER JOIN users u ON u.role_id = r.id WHERE u.id = ? AND u.deleted_at IS NULL`,
    [userId]
  );
  if (roleRows[0]?.slug === 'super-admin') {
    const allPerms = await query<{ slug: string }[]>(
      `SELECT slug FROM permissions WHERE deleted_at IS NULL`
    );
    return allPerms.map((r) => r.slug);
  }

  const rows = await query<{ slug: string }[]>(
    `SELECT p.slug FROM permissions p
     INNER JOIN role_permissions rp ON rp.permission_id = p.id
     INNER JOIN users u ON u.role_id = rp.role_id
     WHERE u.id = ? AND u.deleted_at IS NULL AND p.deleted_at IS NULL`,
    [userId]
  );
  return rows.map((r) => r.slug);
}

export async function hasPermission(userId: number, permSlug: string): Promise<boolean> {
  const perms = await getUserPermissions(userId);
  return perms.includes(permSlug);
}
