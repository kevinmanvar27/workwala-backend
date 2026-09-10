import { NextRequest } from 'next/server';
import { verifyToken } from './jwt';
import { query } from './db';

/**
 * Attempts to get customer information from the Authorization header.
 * Unlike requireMobileAuth, this function does NOT throw or return an error
 * if the token is missing or invalid - it simply returns null.
 * 
 * This is useful for endpoints where authentication is optional.
 * 
 * @param req - The incoming Next.js request
 * @returns Object with customer data if authenticated, or null if not
 */
export async function getCustomerFromToken(
  req: NextRequest
): Promise<{ customer: { id: number; email: string } | null }> {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const rawToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!rawToken) {
      return { customer: null };
    }

    const payload = verifyToken(rawToken);
    if (!payload || payload.roleSlug !== 'customer') {
      return { customer: null };
    }

    // Validate tokenVersion against the DB to support token revocation
    const rows = await query<{ token_version: number }[]>(
      `SELECT token_version FROM customers WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [payload.userId]
    );

    if (rows.length === 0) {
      return { customer: null };
    }

    const dbVersion = rows[0].token_version ?? 1;
    if ((payload.tokenVersion ?? 1) < dbVersion) {
      // Token was revoked
      return { customer: null };
    }

    return {
      customer: {
        id: payload.userId,
        email: payload.email
      }
    };
  } catch (error) {
    // If anything goes wrong, just return null (optional auth)
    return { customer: null };
  }
}
