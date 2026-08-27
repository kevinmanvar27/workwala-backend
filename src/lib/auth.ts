import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
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

/**
 * Authenticates a partner from the `Authorization: Bearer <token>` header.
 * Also validates tokenVersion against the DB so that logout / suspension
 * immediately invalidates previously issued tokens.
 *
 * @returns The partner's numeric ID on success, or `null` if unauthorized.
 */
export async function verifyPartnerAuth(req: NextRequest): Promise<number | null> {
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;

  const payload: JWTPayload | null = verifyToken(token);
  if (!payload || payload.roleSlug !== 'partner') return null;

  // Guard against revoked tokens by comparing tokenVersion with the DB
  const rows = await query<{ token_version: number }[]>(
    `SELECT token_version FROM partners WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [payload.userId]
  );
  if (rows.length === 0) return null;
  if ((payload.tokenVersion ?? 1) !== rows[0].token_version) return null;

  return payload.userId;
}

/**
 * Authenticates a customer from the `Authorization: Bearer <token>` header.
 * Also validates tokenVersion against the DB so that logout / suspension
 * immediately invalidates previously issued tokens.
 *
 * @returns The customer's numeric ID on success, or `null` if unauthorized.
 */
export async function verifyCustomerAuth(req: NextRequest): Promise<number | null> {
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;

  const payload: JWTPayload | null = verifyToken(token);
  if (!payload || payload.roleSlug !== 'customer') return null;

  // Guard against revoked tokens by comparing tokenVersion with the DB
  const rows = await query<{ token_version: number }[]>(
    `SELECT token_version FROM customers WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [payload.userId]
  );
  if (rows.length === 0) return null;
  if ((payload.tokenVersion ?? 1) !== rows[0].token_version) return null;

  return payload.userId;
}
