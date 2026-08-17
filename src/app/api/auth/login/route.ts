import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { query } from '@/lib/db';
// Import both token signers — access token is short-lived (15 min), refresh is 7 days
import { signToken, signRefreshToken } from '@/lib/jwt';
import { logActivity, getClientIp } from '@/lib/activityLogger';

// ── Brute-force protection ────────────────────────────────────────────────────
// In-process store: IP → { count, resetAt }.
// For multi-instance deployments replace with a Redis-backed store.
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS  = 10;           // max failures before lockout
const WINDOW_MS     = 15 * 60_000; // 15-minute sliding window
const LOCKOUT_MS    = 15 * 60_000; // lockout duration after MAX_ATTEMPTS

function checkLoginRateLimit(ip: string): { allowed: boolean; retryAfterSec: number } {
  const now    = Date.now();
  const record = loginAttempts.get(ip);

  if (!record || now > record.resetAt) {
    // First attempt or window expired — reset
    loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfterSec: 0 };
  }

  if (record.count >= MAX_ATTEMPTS) {
    const retryAfterSec = Math.ceil((record.resetAt - now) / 1000);
    return { allowed: false, retryAfterSec };
  }

  record.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}

function clearLoginAttempts(ip: string) {
  loginAttempts.delete(ip);
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('cf-connecting-ip')
            || req.headers.get('x-forwarded-for')?.split(',')[0].trim()
            || req.headers.get('x-real-ip')
            || 'unknown';

    // Rate-limit check BEFORE touching the DB
    const { allowed, retryAfterSec } = checkLoginRateLimit(ip);
    if (!allowed) {
      return NextResponse.json(
        { error: `Too many login attempts. Try again in ${retryAfterSec} seconds.` },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfterSec) },
        }
      );
    }

    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const users = await query<{
      id: number; name: string; email: string; password: string;
      role_id: number; role_name: string; role_slug: string; status: string;
    }[]>(
      `SELECT u.id, u.name, u.email, u.password, u.role_id, u.status,
              r.name as role_name, r.slug as role_slug
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.email = ? AND u.deleted_at IS NULL`,
      [email]
    );

    if (users.length === 0) {
      // Uniform error — do not reveal whether the email exists
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const user = users[0];

    if (user.status === 'banned') {
      return NextResponse.json({ error: 'Your account has been banned' }, { status: 403 });
    }
    if (user.status === 'inactive') {
      return NextResponse.json({ error: 'Your account is inactive' }, { status: 403 });
    }
    if (!user.password) {
      return NextResponse.json({ error: 'Please use social login' }, { status: 400 });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Successful login — clear the failure counter for this IP
    clearLoginAttempts(ip);

    const tokenPayload = {
      userId: user.id,
      email: user.email,
      roleSlug: user.role_slug || 'user',
      roleName: user.role_name || 'User',
    };

    // Short-lived access token (15 min) + long-lived refresh token (7 days)
    const accessToken  = signToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);

    // Generate a cryptographically random CSRF token
    const csrfToken = randomBytes(32).toString('hex');

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role_name },
    });

    const isProduction = process.env.NODE_ENV === 'production';

    // Access token — short TTL, matches signToken expiry
    response.cookies.set('auth_token', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 60 * 15,          // 15 minutes
      path: '/',
    });

    // Refresh token — long TTL, path-scoped so it's only sent to /api/auth/refresh
    response.cookies.set('refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/api/auth/refresh',
    });

    // CSRF token — NOT httpOnly so JavaScript can read and send as x-csrf-token header
    response.cookies.set('csrf_token', csrfToken, {
      httpOnly: false,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 60 * 15,          // matches access token TTL
      path: '/',
    });

    await logActivity({
      userId: user.id, userName: user.name,
      action: 'Login', module: 'auth',
      description: `Logged in as ${user.role_name || 'User'}`,
      ipAddress: ip,
    });

    return response;
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
