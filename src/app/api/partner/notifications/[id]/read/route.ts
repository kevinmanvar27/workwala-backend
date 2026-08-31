import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireMobileAuth } from '@/lib/mobileAuth';

/**
 * PATCH /api/partner/notifications/[id]/read
 * Mark a notification as read (opened)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError, user: payload } = await requireMobileAuth(req, 'partner');
    if (authError) return authError;

    const partnerId = payload!.userId;
    const { id } = await params;
    const notificationLogId = parseInt(id, 10);

    if (isNaN(notificationLogId)) {
      return NextResponse.json(
        { success: false, message: 'Invalid notification ID' },
        { status: 400 }
      );
    }

    // Update the notification log to mark it as opened
    await query(
      `UPDATE push_notification_logs
       SET status = 'opened',
           opened_at = NOW(),
           updated_at = NOW()
       WHERE id = ?
         AND recipient_type = 'partner'
         AND recipient_id = ?
         AND opened_at IS NULL`,
      [notificationLogId, partnerId]
    );

    return NextResponse.json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (error: any) {
    console.error('[PATCH /api/partner/notifications/[id]/read] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Failed to mark notification as read',
      },
      { status: 500 }
    );
  }
}
