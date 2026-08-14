import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';

// POST /api/admin/notifications/read
// Sets the last_read_at cookie to now so unread_count resets to 0.
export async function POST(req: NextRequest) {
  const { error } = await requireAuth(req);
  if (error) return error;

  const now = new Date().toISOString();
  const res = NextResponse.json({ success: true });

  res.cookies.set('notif_last_read', now, {
    httpOnly: false,   // client JS needs to read it for optimistic badge reset
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });

  return res;
}
