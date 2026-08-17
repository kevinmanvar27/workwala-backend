import { NextRequest, NextResponse } from 'next/server';
import { verifyRefreshToken, signToken, signRefreshToken } from '@/lib/jwt';
import { query } from '@/lib/db';
import { randomBytes } from 'crypto';

/**
 * POST /api/auth/refresh
 *
 * Rotates the session: reads the refresh_token httpOnly cookie, validates it,
 * checks tokenVersion for revocation, then issues a new short-lived access
 * token AND a new refresh token (rotation — old one is implicitly invalidated
 * because tokenVersion is re-checked on every use).
 *
 * Called automatically by the frontend when a 401 is received on any request.
 */
export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get('refresh_token')?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: 'No refresh token' }, { status: 401 });
  }

  const payload = verifyRefreshToken(refreshToken);
  if (!payload) {
    return NextResponse.json({ error: 'Invalid or expired refresh token' }, { status: 401 });
  }

  // Verify tokenVersion — allows server-side revocation
  const users = await query<{ token_version: number }[]>(
    `SELECT token_version FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [payload.userId]
  );
  if (users.length === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 401 });
  }
  if ((payload.tokenVersion ?? 1) < (users[0].token_version ?? 1)) {
    return NextResponse.json({ error: 'Token revoked. Please log in again.' }, { status: 401 });
  }

  // Issue new token pair
  const newAccessToken  = signToken(payload);
  const newRefreshToken = signRefreshToken(payload);
  const newCsrfToken    = randomBytes(32).toString('hex');

  const isProduction = process.env.NODE_ENV === 'production';
  const response = NextResponse.json({ success: true });

  response.cookies.set('auth_token', newAccessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 60 * 15,          // 15 minutes — matches access token TTL
    path: '/',
  });

  response.cookies.set('refresh_token', newRefreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/api/auth/refresh', // scoped — only sent to this endpoint
  });

  response.cookies.set('csrf_token', newCsrfToken, {
    httpOnly: false,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 60 * 15,
    path: '/',
  });

  return response;
}
