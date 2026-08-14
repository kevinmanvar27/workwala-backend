import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';
import { logActivity, getClientIp } from '@/lib/activityLogger';

export async function POST(req: NextRequest) {
  // Best-effort: log the logout before clearing the cookie
  const { user } = await requireAuth(req);
  if (user) {
    await logActivity({
      userId: user.userId, userName: user.email,
      action: 'Logout', module: 'auth',
      ipAddress: getClientIp(req),
    });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set('auth_token', '', { maxAge: 0, path: '/' });
  return response;
}
