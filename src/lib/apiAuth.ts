import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { verifyToken } from './jwt';
import { query } from './db';

// ── CSRF validation ───────────────────────────────────────────────────────────
// State-mutating methods (POST/PATCH/PUT/DELETE) must carry an x-csrf-token
// header whose value matches the csrf_token cookie set at login.
// GET and HEAD are exempt (read-only, no side effects).
const CSRF_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

function validateCsrf(req: NextRequest): boolean {
  if (!CSRF_METHODS.has(req.method)) return true;
  const headerToken = req.headers.get('x-csrf-token');
  const cookieToken = req.cookies.get('csrf_token')?.value;
  if (!headerToken || !cookieToken) return false;
  // Use timing-safe comparison to prevent timing oracle attacks
  try {
    const a = Buffer.from(headerToken);
    const b = Buffer.from(cookieToken);
    // Buffers must be the same length for timingSafeEqual; unequal lengths → reject
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function requireAuth(req: NextRequest) {
  const token = req.cookies.get('auth_token')?.value;
  if (!token) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null };
  }
  const payload = verifyToken(token);
  if (!payload) {
    return { error: NextResponse.json({ error: 'Invalid token' }, { status: 401 }), user: null };
  }

  // CSRF check for all state-mutating requests
  if (!validateCsrf(req)) {
    return { error: NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 }), user: null };
  }

  return { error: null, user: payload };
}

export async function requirePermission(req: NextRequest, permSlug: string) {
  const { error, user } = await requireAuth(req);
  if (error || !user) return { error: error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null };

  // Super Admin bypass — role slug 'super-admin' has unrestricted access
  const roleRows = await query<{ slug: string }[]>(
    `SELECT r.slug FROM roles r INNER JOIN users u ON u.role_id = r.id WHERE u.id = ? AND u.deleted_at IS NULL`,
    [user.userId]
  );
  if (roleRows[0]?.slug === 'super-admin') {
    return { error: null, user };
  }

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
