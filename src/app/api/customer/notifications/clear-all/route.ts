import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireMobileAuth } from '@/lib/mobileAuth';
import type { ResultSetHeader } from 'mysql2';

/**
 * DELETE /api/customer/notifications/clear-all
 * Delete all notifications for the authenticated customer.
 */
export async function DELETE(req: NextRequest) {
  try {
    const { error: authError, user: payload } = await requireMobileAuth(req, 'customer');
    if (authError) return authError;

    const customerId = payload!.userId;

    const result = await query<ResultSetHeader>(
      `DELETE FROM push_notification_logs
       WHERE recipient_type = 'customer'
         AND recipient_id = ?`,
      [customerId]
    );

    return NextResponse.json({
      success: true,
      message: `${result.affectedRows} notification(s) cleared`,
      cleared_count: result.affectedRows,
    });
  } catch (error: any) {
    console.error('[DELETE /api/customer/notifications/clear-all] Error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to clear notifications' },
      { status: 500 }
    );
  }
}
