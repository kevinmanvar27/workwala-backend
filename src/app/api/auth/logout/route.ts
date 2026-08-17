import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';
import { logActivity, getClientIp } from '@/lib/activityLogger';

export async function POST(req: NextRequest) {
  // Best-effort: log the logout before clearing cookies
  const { user } = await requireAuth(req);
  if (user) {
    await logActivity({
      userId: user.userId, userName: user.email,
      action: 'Logout', module: 'auth',
      ipAddress: getClientIp(req),
    });
  }

  const response = NextResponse.json({ success: true });

  // Clear all three session cookies — access token, refresh token, and CSRF token
  response.cookies.set('auth_token',    '', { maxAge: 0, path: '/' });
  response.cookies.set('refresh_token', '', { maxAge: 0, path: '/api/auth/refresh' });
  response.cookies.set('csrf_token',    '', { maxAge: 0, path: '/' });

  return response;
}
