import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from './jwt';
import { query } from './db';

/**
 * Authenticates a mobile API request (customer or partner).
 *
 * Reads the Bearer token from the Authorization header, verifies the JWT
 * signature, then checks the tokenVersion in the DB to support revocation.
 * Incrementing token_version in the DB immediately invalidates all
 * previously issued tokens for that user.
 *
 * @param req       - The incoming Next.js request
 * @param roleSlug  - Expected role: 'customer' | 'partner'
 */
export async function requireMobileAuth(
  req: NextRequest,
  roleSlug: 'customer' | 'partner'
): Promise<
  | { error: NextResponse; user: null }
  | { error: null; user: { userId: number; email: string; roleSlug: string; roleName: string; tokenVersion?: number } }
> {
  const authHeader = req.headers.get('authorization') || '';
  const rawToken   = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!rawToken) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null };
  }

  const payload = verifyToken(rawToken);
  if (!payload || payload.roleSlug !== roleSlug) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null };
  }

  // Validate tokenVersion against the DB to support token revocation
  const table = roleSlug === 'customer' ? 'customers' : 'partners';
  const rows  = await query<{ token_version: number }[]>(
    `SELECT token_version FROM ${table} WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [payload.userId]
  );

  if (rows.length === 0) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null };
  }

  const dbVersion = rows[0].token_version ?? 1;
  if ((payload.tokenVersion ?? 1) < dbVersion) {
    // Token was revoked (e.g. user logged out from all devices, account suspended)
    return {
      error: NextResponse.json({ error: 'Token revoked. Please log in again.' }, { status: 401 }),
      user:  null,
    };
  }

  return { error: null, user: payload };
}

/**
 * Revokes all active tokens for a mobile user by incrementing token_version.
 * Call this on logout, account suspension, or password/phone change.
 *
 * @param userId   - The customer or partner ID
 * @param roleSlug - 'customer' | 'partner'
 */
export async function revokeMobileTokens(
  userId: number,
  roleSlug: 'customer' | 'partner'
): Promise<void> {
  const table = roleSlug === 'customer' ? 'customers' : 'partners';
  await query(
    `UPDATE ${table} SET token_version = token_version + 1 WHERE id = ?`,
    [userId]
  );
}
