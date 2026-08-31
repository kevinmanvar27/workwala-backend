import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireMobileAuth } from '@/lib/mobileAuth';
import type { ResultSetHeader } from 'mysql2';

/**
 * POST /api/customer/notifications/read-all
 * Mark all unread notifications as read for the authenticated customer.
 */
export async function POST(req: NextRequest) {
  try {
    const { error: authError, user: payload } = await requireMobileAuth(req, 'customer');
    if (authError) return authError;

    const customerId = payload!.userId;

    const result = await query<ResultSetHeader>(
      `UPDATE push_notification_logs
       SET status = 'opened',
           opened_at = NOW(),
           updated_at = NOW()
       WHERE recipient_type = 'customer'
         AND recipient_id = ?
         AND opened_at IS NULL`,
      [customerId]
    );

    return NextResponse.json({
      success: true,
      message: `${result.affectedRows} notification(s) marked as read`,
      updated_count: result.affectedRows,
    });
  } catch (error: any) {
    console.error('[POST /api/customer/notifications/read-all] Error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to mark all as read' },
      { status: 500 }
    );
  }
}
