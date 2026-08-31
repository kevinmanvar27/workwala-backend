import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireMobileAuth } from '@/lib/mobileAuth';

/**
 * DELETE /api/partner/notifications/clear-all
 * Mark all notifications as read for the authenticated partner
 */
export async function DELETE(req: NextRequest) {
  try {
    const { error: authError, user: payload } = await requireMobileAuth(req, 'partner');
    if (authError) return authError;

    const partnerId = payload!.userId;

    // Mark all unread notifications as opened
    await query(
      `UPDATE push_notification_logs
       SET status = 'opened',
           opened_at = NOW(),
           updated_at = NOW()
       WHERE recipient_type = 'partner'
         AND recipient_id = ?
         AND opened_at IS NULL`,
      [partnerId]
    );

    return NextResponse.json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error: any) {
    console.error('[DELETE /api/partner/notifications/clear-all] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Failed to clear notifications',
      },
      { status: 500 }
    );
  }
}
