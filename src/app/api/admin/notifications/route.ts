import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';
import { query } from '@/lib/db';

export interface Notification {
  id: number;
  user_name: string;
  action: string;
  module: string;
  target_name: string | null;
  description: string | null;
  created_at: string;
}

// GET /api/admin/notifications
// Returns the 15 most recent activity_log entries as notifications.
// Also computes unread_count based on the last_read_at cookie.
export async function GET(req: NextRequest) {
  const { error } = await requireAuth(req);
  if (error) return error;

  try {
    const notifications = await query<Notification[]>(
      `SELECT id, user_name, action, module, target_name, description, created_at
       FROM activity_logs
       WHERE deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT 15`
    );

    // Determine unread count from cookie
    const lastReadAt = req.cookies.get('notif_last_read')?.value;
    let unreadCount = 0;

    if (lastReadAt) {
      const lastRead = new Date(lastReadAt);
      unreadCount = notifications.filter(
        (n) => new Date(n.created_at) > lastRead
      ).length;
    } else {
      // Never read — all are "unread", cap display badge at 15
      unreadCount = notifications.length;
    }

    return NextResponse.json({ notifications, unread_count: unreadCount });
  } catch (err) {
    console.error('Notifications GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
