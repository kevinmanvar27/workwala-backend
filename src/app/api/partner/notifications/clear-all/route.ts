import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireMobileAuth } from '@/lib/mobileAuth';
import type { ResultSetHeader } from 'mysql2';

/**
 * DELETE /api/partner/notifications/clear-all
 * Delete all notifications for the authenticated partner
 */
export async function DELETE(req: NextRequest) {
  try {
    const { error: authError, user: payload } = await requireMobileAuth(req, 'partner');
    if (authError) return authError;

    const partnerId = payload!.userId;

    // Delete all notifications for the partner
    const result = await query<ResultSetHeader>(
      `DELETE FROM push_notification_logs
       WHERE recipient_type = 'partner'
         AND recipient_id = ?`,
      [partnerId]
    );

    return NextResponse.json({
      success: true,
      message: 'All notifications cleared',
      cleared_count: result.affectedRows || 0,
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
